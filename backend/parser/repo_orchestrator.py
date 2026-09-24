"""
Repository Pipeline Orchestrator Module.

This module provides the high-level orchestration logic for parsing an entire code repository.
It coordinates repository file discovery (via the abstract `VCSProvider`) and code entity
extraction (via the abstract `EntityExtractor`).

Following the Dependency Inversion Principle, this orchestrator depends strictly on
the abstract interfaces, remaining completely decoupled from specific version control
command-line tools or specific language AST implementations.

Author: REI Team
"""

import ast
import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Type

from backend.parser.ast_extractor import EntityExtractor
from backend.parser.git_service import VCSProvider

logger = logging.getLogger(__name__)


class RepositoryOrchestrator:
    """
    High-level orchestrator for parsing repositories.

    Coordinates the version control provider and entity extractor to:
    1. Resolve the repository root and retrieve repository metadata.
    2. Identify all tracked files, filtering by target extensions.
    3. Retrieve file contents securely from the VCS provider.
    4. Run the injected entity extractor over each target file.
    5. Aggregate module entities, symbols, imports, and metadata into a unified dictionary.
    """

    def __init__(
        self,
        vcs_provider: VCSProvider,
        extractor_cls: Type[EntityExtractor],
    ):
        """
        Initializes the RepositoryOrchestrator with injected abstractions.

        Args:
            vcs_provider: Concrete implementation of the abstract `VCSProvider` interface.
            extractor_cls: Class implementing the abstract `EntityExtractor` interface.
        """
        if not isinstance(vcs_provider, VCSProvider):
            raise TypeError(
                f"vcs_provider must implement VCSProvider, got {type(vcs_provider).__name__}"
            )
        if not issubclass(extractor_cls, EntityExtractor):
            raise TypeError(
                f"extractor_cls must implement EntityExtractor, got {extractor_cls.__name__}"
            )

        self.vcs_provider = vcs_provider
        self.extractor_cls = extractor_cls

    def parse(
        self,
        path_or_url: Optional[str] = None,
        ref: Optional[str] = None,
        file_extensions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Orchestrates full parsing of a repository.

        Args:
            path_or_url: Local directory path or remote Git repository URL.
                If None, auto-detects the active repository.
            ref: Optional revision reference (e.g. 'HEAD', 'main', commit SHA).
            file_extensions: Optional list of file extensions to parse (default: ['.py']).

        Returns:
            A structured dictionary containing:
                - 'repo_name': str, repository name.
                - 'repo_root': str, filesystem root path.
                - 'git_commit': str, active commit SHA.
                - 'git_branch': str, active branch name.
                - 'git_remote': str, origin repository URL.
                - 'files': List[str], all tracked repository files.
                - 'file_map': Dict[str, str], mapping of relative path to file content.
                - 'total_files': int, total count of tracked files.
                - 'python_files': List[str], tracked files matching target extensions.
                - 'entities': List[Dict[str, Any]], all extracted code entities.
                - 'imports': List[Dict[str, Any]], all extracted import dependencies.
                - 'total_entities': int, count of extracted entities.
        """
        repo_root = self.vcs_provider.resolve_repository(path_or_url)
        metadata = self.vcs_provider.get_metadata(repo_root)
        tracked_files = self.vcs_provider.get_tracked_files(repo_root, ref=ref)

        all_entities: List[Dict[str, Any]] = []
        all_imports: List[Dict[str, Any]] = []
        file_map: Dict[str, str] = {}
        python_files: List[str] = []

        target_exts: Tuple[str, ...] = (
            tuple(file_extensions) if file_extensions else (".py",)
        )

        for rel_path in tracked_files:
            full_path = os.path.join(repo_root, rel_path)
            is_vendor = any(
                v in rel_path
                for v in ["node_modules/", "vendor/", "dist/", ".cache/"]
            )
            is_target = rel_path.endswith(target_exts)

            # Skip reading content for large vendor directories unless they are target source files
            if is_vendor and not is_target:
                content = ""
            else:
                content = self.vcs_provider.get_file_content(
                    repo_root, rel_path, ref=ref
                )

            file_map[rel_path] = content

            if is_target:
                python_files.append(rel_path)
                try:
                    extractor = self.extractor_cls(
                        full_path, rel_path, content
                    )
                    extracted_entities = extractor.extract()

                    # Create top-level module container entity
                    docstring = ""
                    try:
                        tree = ast.parse(content, filename=rel_path)
                        docstring = ast.get_docstring(tree) or ""
                    except Exception:
                        pass

                    source_lines = content.splitlines()
                    mod_entity = {
                        "id": extractor.module_name,
                        "name": rel_path,
                        "type": "module",
                        "file_path": rel_path,
                        "full_name": extractor.module_name,
                        "docstring": docstring,
                        "start_line": 1,
                        "end_line": len(source_lines),
                        "snippet": (
                            content[:300] + "..."
                            if len(content) > 300
                            else content
                        ),
                        "signature": f"module {rel_path}",
                    }
                    all_entities.append(mod_entity)
                    all_entities.extend(extracted_entities)

                    for imp in extractor.imports:
                        imp["source_file"] = rel_path
                        all_imports.append(imp)
                except Exception as e:
                    logger.warning(f"Error parsing entities for {rel_path}: {e}")

        return {
            "repo_name": metadata.get("repo_name", ""),
            "repo_root": repo_root,
            "git_commit": metadata.get("git_commit", ""),
            "git_branch": metadata.get("git_branch", ""),
            "git_remote": metadata.get("git_remote", ""),
            "files": tracked_files,
            "file_map": file_map,
            "total_files": len(tracked_files),
            "python_files": python_files,
            "entities": all_entities,
            "imports": all_imports,
            "total_entities": len(all_entities),
        }

