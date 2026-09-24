"""
Repository Evolution Intelligence (REI) - Repository Parser Facade.

This module serves as the public entrypoint, facade, and composition root for
repository parsing within the REI platform.

Architecture & Responsibilities:
- `VCSProvider`: Abstract interface for repository and VCS access (defined in `git_service.py`).
- `GitService`: Concrete implementation of `VCSProvider` for Git repositories (defined in `git_service.py`).
- `EntityExtractor`: Abstract interface for code entity extraction (defined in `ast_extractor.py`).
- `ASTEntityExtractor`: Concrete implementation of `EntityExtractor` for Python AST (defined in `ast_extractor.py`).
- `RepositoryOrchestrator`: High-level pipeline coordinator decoupled from concrete VCS/AST details (defined in `repo_orchestrator.py`).
- `parse_git_repository()`: Composition Root that resolves defaults, configures dependency injection,
  and executes repository parsing.

Author: REI Team
"""

import logging
from typing import Any, Dict, List, Optional, Type

from backend.parser.ast_extractor import ASTEntityExtractor as BaseASTEntityExtractor, EntityExtractor
from backend.parser.git_service import GitService, VCSProvider
from backend.parser.repo_orchestrator import RepositoryOrchestrator

logger = logging.getLogger(__name__)

# Public re-exports for clean architectural consumption
__all__ = [
    "VCSProvider",
    "GitService",
    "EntityExtractor",
    "ASTEntityExtractor",
    "RepositoryOrchestrator",
    "GitRepoParser",
    "parse_git_repository",
    "parse_repository",
    "parse_smartfix_repository",
]


class ASTEntityExtractor(BaseASTEntityExtractor):
    """
    Backwards-compatible class alias for `BaseASTEntityExtractor`.

    Extends the concrete ASTEntityExtractor from `ast_extractor.py` to preserve
    backwards compatibility for callers importing from `backend.parser.repo_parser`.
    """
    pass


class GitRepoParser(RepositoryOrchestrator):
    """
    Backwards-compatible wrapper alias for `RepositoryOrchestrator`.

    Provides seamless drop-in compatibility for existing code while enabling
    dependency injection of custom `VCSProvider` or `EntityExtractor` implementations.
    """

    def __init__(
        self,
        cache_dir: Optional[str] = None,
        vcs_provider: Optional[VCSProvider] = None,
        extractor_cls: Optional[Type[EntityExtractor]] = None,
    ):
        """
        Initializes the parser, injecting defaults if custom providers are not supplied.

        Args:
            cache_dir: Optional filesystem path for cloning remote repositories.
            vcs_provider: Optional concrete VCSProvider (defaults to GitService).
            extractor_cls: Optional concrete EntityExtractor (defaults to ASTEntityExtractor).
        """
        vcs = vcs_provider or GitService(cache_dir=cache_dir)
        extractor = extractor_cls or ASTEntityExtractor
        super().__init__(vcs_provider=vcs, extractor_cls=extractor)


def parse_git_repository(
    repo_path: Optional[str] = None,
    ref: Optional[str] = None,
    git_url: Optional[str] = None,
    cache_dir: Optional[str] = None,
    file_extensions: Optional[List[str]] = None,
    vcs_provider: Optional[VCSProvider] = None,
    extractor_cls: Optional[Type[EntityExtractor]] = None,
) -> Dict[str, Any]:
    """
    Parses a repository directly from Git using injected or default components.

    Acts as the **Composition Root**:
    1. Determines which `VCSProvider` to use (defaults to `GitService`).
    2. Determines which `EntityExtractor` to use (defaults to `ASTEntityExtractor`).
    3. Injects both into `RepositoryOrchestrator` and runs the parsing pipeline.

    Args:
        repo_path: Local repository filesystem path (or None to auto-detect).
        ref: Optional commit, branch, or tag reference (e.g., 'HEAD', 'main').
        git_url: Optional remote Git URL to clone or locate in cache.
        cache_dir: Optional directory for cached remote repository clones.
        file_extensions: List of extensions to extract AST entities from (default: ['.py']).
        vcs_provider: Custom VCS provider implementing the `VCSProvider` interface.
        extractor_cls: Custom entity extractor class implementing the `EntityExtractor` interface.

    Returns:
        A unified dictionary containing repository metadata, file map, entities, and imports.
    """
    target = git_url or repo_path
    vcs = vcs_provider or GitService(cache_dir=cache_dir)
    extractor = extractor_cls or ASTEntityExtractor
    orchestrator = RepositoryOrchestrator(vcs_provider=vcs, extractor_cls=extractor)
    return orchestrator.parse(target, ref=ref, file_extensions=file_extensions)


# Backwards-compatibility aliases
parse_repository = parse_git_repository
parse_smartfix_repository = parse_git_repository


if __name__ == "__main__":
    result = parse_git_repository()
    print(
        f"Git Repository: {result['repo_name']} "
        f"(branch: {result['git_branch']}, commit: {result['git_commit'][:7] if result['git_commit'] else 'N/A'})"
    )
    print(
        f"Tracked Files: {result['total_files']} ({len(result['python_files'])} Python files)"
    )
    print(f"Extracted {result['total_entities']} AST entities.")
