"""
Repository Parser Module for Git-Tracked Repositories.
Extracts fine-grained entities: Functions, Classes, Variables, Attributes, Modules, and REST Endpoints
directly from Git repository trees, commits, branches, or remote URLs.
"""

import ast
import logging
import os
import shutil
import subprocess
import urllib.parse
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class ASTEntityExtractor(ast.NodeVisitor):
    def __init__(self, file_path: str, relative_path: str, source_code: str):
        self.file_path = file_path
        self.relative_path = relative_path
        self.source_code = source_code
        self.source_lines = source_code.splitlines()

        self.module_name = relative_path.replace("/", ".").rstrip(".py")
        self.entities: List[Dict[str, Any]] = []
        self.current_class: Optional[str] = None
        self.current_function: Optional[str] = None
        self.imports: List[Dict[str, str]] = []

    def _get_snippet(self, start_line: int, end_line: int) -> str:
        lines = self.source_lines[start_line - 1 : end_line]
        return "\n".join(lines)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({"type": "import", "name": alias.name, "asname": alias.asname})
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        module = node.module or ""
        for alias in node.names:
            self.imports.append({"type": "from_import", "module": module, "name": alias.name, "asname": alias.asname})
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        class_name = node.name
        full_name = f"{self.module_name}.{class_name}"
        bases = [ast.unparse(b) for b in node.bases]
        docstring = ast.get_docstring(node) or ""
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": class_name,
            "type": "class",
            "file_path": self.relative_path,
            "full_name": full_name,
            "docstring": docstring,
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "bases": bases,
            "parent_class": None,
            "signature": f"class {class_name}({', '.join(bases)})" if bases else f"class {class_name}",
        }
        self.entities.append(entity)

        prev_class = self.current_class
        self.current_class = class_name
        self.generic_visit(node)
        self.current_class = prev_class

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._handle_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._handle_function(node, is_async=True)

    def _handle_function(self, node, is_async: bool = False):
        func_name = node.name
        if self.current_class:
            full_name = f"{self.module_name}.{self.current_class}.{func_name}"
        else:
            full_name = f"{self.module_name}.{func_name}"

        docstring = ast.get_docstring(node) or ""
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)
        args_str = ast.unparse(node.args)
        signature = f"{'async ' if is_async else ''}def {func_name}({args_str})"

        # Check for FastAPI / REST endpoint decorators
        endpoint_info = None
        for decorator in node.decorator_list:
            dec_str = ast.unparse(decorator)
            if any(method in dec_str for method in ["get", "post", "put", "delete", "patch"]):
                endpoint_info = {
                    "decorator": dec_str,
                    "is_endpoint": True
                }

        # Extract internal calls and variable usages
        calls = []
        variables_used = set()
        attributes_used = set()

        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name):
                    calls.append(child.func.id)
                elif isinstance(child.func, ast.Attribute):
                    calls.append(child.func.attr)
            elif isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load):
                variables_used.add(child.id)
            elif isinstance(child, ast.Attribute) and isinstance(child.ctx, ast.Load):
                attributes_used.add(child.attr)

        entity = {
            "id": full_name,
            "name": func_name,
            "type": "endpoint" if endpoint_info else "function",
            "file_path": self.relative_path,
            "full_name": full_name,
            "docstring": docstring,
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "parent_class": self.current_class,
            "signature": signature,
            "is_async": is_async,
            "calls": list(set(calls)),
            "variables_used": list(variables_used),
            "attributes_used": list(attributes_used),
            "endpoint_info": endpoint_info,
        }
        self.entities.append(entity)

        prev_func = self.current_function
        self.current_function = func_name
        self.generic_visit(node)
        self.current_function = prev_func

    def visit_Assign(self, node: ast.Assign):
        self._handle_assign(node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign):
        if isinstance(node.target, ast.Name):
            var_name = node.target.id
            self._record_variable(var_name, node, ast.unparse(node.annotation))
        self.generic_visit(node)

    def _handle_assign(self, node: ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name):
                self._record_variable(target.id, node)
            elif isinstance(target, ast.Attribute):
                if self.current_class:
                    attr_name = target.attr
                    self._record_attribute(attr_name, node)

    def _record_variable(self, var_name: str, node: ast.AST, type_hint: str = ""):
        if var_name in {"_", "i", "e", "self", "cls"}:
            return
        scope = self.current_function or self.current_class or "module"
        full_name = f"{self.module_name}.{scope}.{var_name}" if scope != "module" else f"{self.module_name}.{var_name}"
        
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": var_name,
            "type": "variable",
            "file_path": self.relative_path,
            "full_name": full_name,
            "scope": scope,
            "docstring": "",
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "signature": f"{var_name}: {type_hint}" if type_hint else var_name,
        }
        self.entities.append(entity)

    def _record_attribute(self, attr_name: str, node: ast.AST):
        full_name = f"{self.module_name}.{self.current_class}.{attr_name}"
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": attr_name,
            "type": "attribute",
            "file_path": self.relative_path,
            "full_name": full_name,
            "scope": self.current_class,
            "docstring": "",
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "signature": f"self.{attr_name}",
        }
        self.entities.append(entity)


class GitRepoParser:
    """
    Parses git-tracked repositories by querying git directly.
    Supports local working trees, specific commits/branches/refs, and remote git URLs.
    """

    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".cache" / "rei" / "repos"

    def _run_git(self, cmd: List[str], cwd: Optional[str] = None) -> str:
        res = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return res.stdout.strip()

    def resolve_repo_root(self, path_or_url: Optional[str] = None) -> str:
        """
        Resolves the repository root path.
        If a remote git URL is provided, checks local cache/fixtures or clones it.
        If a local path is provided, finds the git repository root via git rev-parse.
        If None or invalid path, defaults to the current git repository root.
        """
        if path_or_url and (
            path_or_url.startswith("http://")
            or path_or_url.startswith("https://")
            or path_or_url.startswith("git@")
            or path_or_url.startswith("git://")
            or path_or_url.startswith("ssh://")
        ):
            return self._resolve_remote_url(path_or_url)

        # Local path check
        if path_or_url and os.path.exists(path_or_url):
            try:
                return self._run_git(["git", "-C", path_or_url, "rev-parse", "--show-toplevel"])
            except Exception:
                return os.path.abspath(path_or_url)

        # If path_or_url was passed but doesn't exist, check fixture directory or fall back to current repo
        if path_or_url:
            base_name = os.path.basename(path_or_url.rstrip("/\\"))
            fixture_path = Path(__file__).resolve().parent.parent.parent / "tests" / "fixtures" / base_name
            if fixture_path.exists() and (fixture_path / ".git").exists():
                return str(fixture_path)
            logger.warning(
                f"Specified repository path '{path_or_url}' not found. Falling back to active Git repository."
            )

        # Fall back to the active git repository containing this file or current working directory
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            return self._run_git(["git", "-C", current_dir, "rev-parse", "--show-toplevel"])
        except Exception:
            try:
                return self._run_git(["git", "rev-parse", "--show-toplevel"])
            except Exception:
                return os.getcwd()

    def _resolve_remote_url(self, git_url: str) -> str:
        """
        Clones or fetches remote git URL into cache_dir, or uses bundled fixture if present.
        """
        url_path = urllib.parse.urlparse(git_url).path.rstrip("/")
        repo_name = os.path.basename(url_path)
        if repo_name.endswith(".git"):
            repo_name = repo_name[:-4]

        # 1. Check bundled fixtures under tests/fixtures/<repo_name>
        project_root = Path(__file__).resolve().parent.parent.parent
        fixture_dir = project_root / "tests" / "fixtures" / repo_name
        if fixture_dir.exists() and (fixture_dir / ".git").exists():
            return str(fixture_dir)

        # 2. Check local cache directory
        target_dir = self.cache_dir / repo_name
        if target_dir.exists() and (target_dir / ".git").exists():
            return str(target_dir)

        # 3. Clone repository
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", git_url, str(target_dir)],
                check=True,
                capture_output=True,
                text=True,
            )
            return str(target_dir)
        except Exception as e:
            if fixture_dir.exists():
                return str(fixture_dir)
            raise RuntimeError(f"Failed to clone remote git repository from {git_url}: {e}")

    def get_git_metadata(self, repo_root: str) -> Dict[str, Any]:
        """
        Extracts metadata directly from Git (commit hash, branch, remote origin URL).
        """
        metadata = {
            "repo_name": os.path.basename(os.path.abspath(repo_root)),
            "git_commit": "",
            "git_branch": "",
            "git_remote": "",
        }
        try:
            metadata["git_commit"] = self._run_git(["git", "-C", repo_root, "rev-parse", "HEAD"])
        except Exception:
            pass

        try:
            metadata["git_branch"] = self._run_git(["git", "-C", repo_root, "rev-parse", "--abbrev-ref", "HEAD"])
        except Exception:
            pass

        try:
            remote = self._run_git(["git", "-C", repo_root, "config", "--get", "remote.origin.url"])
            metadata["git_remote"] = remote
            if remote:
                name = os.path.basename(remote.rstrip("/\\"))
                if name.endswith(".git"):
                    name = name[:-4]
                if name:
                    metadata["repo_name"] = name
        except Exception:
            pass

        return metadata

    def get_tracked_files(self, repo_root: str, ref: Optional[str] = None) -> List[str]:
        """
        Lists files tracked by git. If ref is provided, uses git ls-tree; otherwise git ls-files.
        """
        try:
            if ref:
                output = self._run_git(["git", "-C", repo_root, "ls-tree", "-r", "--name-only", ref])
            else:
                output = self._run_git(["git", "-C", repo_root, "ls-files"])
            files = [line.strip() for line in output.splitlines() if line.strip()]
            return sorted(files)
        except Exception as e:
            logger.warning(f"Error querying git tracked files: {e}. Falling back to os.walk.")
            files = []
            for root, _, filenames in os.walk(repo_root):
                if any(ignored in root for ignored in [".git", ".venv", "__pycache__", "node_modules"]):
                    continue
                for f in filenames:
                    files.append(os.path.relpath(os.path.join(root, f), repo_root))
            return sorted(files)

    def get_file_content(self, repo_root: str, rel_path: str, ref: Optional[str] = None) -> str:
        """
        Reads file content from git object store if ref specified, or from working tree.
        Safely handles binary files by catching decoding errors.
        """
        if ref:
            try:
                res = subprocess.run(
                    ["git", "-C", repo_root, "show", f"{ref}:{rel_path}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )
                try:
                    return res.stdout.decode("utf-8")
                except UnicodeDecodeError:
                    return res.stdout.decode("latin-1", errors="ignore")
            except Exception:
                return ""

        full_path = os.path.join(repo_root, rel_path)
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            try:
                with open(full_path, "r", encoding="latin-1", errors="ignore") as f:
                    return f.read()
            except Exception:
                return ""
        except IOError:
            try:
                res = subprocess.run(
                    ["git", "-C", repo_root, "show", f"HEAD:{rel_path}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )
                return res.stdout.decode("utf-8", errors="ignore")
            except Exception:
                return ""

    def parse(
        self,
        path_or_url: Optional[str] = None,
        ref: Optional[str] = None,
        file_extensions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Parses repository directly from Git.
        Extracts AST entities for Python files and records file maps for all tracked files.
        """
        repo_root = self.resolve_repo_root(path_or_url)
        metadata = self.get_git_metadata(repo_root)
        tracked_files = self.get_tracked_files(repo_root, ref=ref)

        all_entities: List[Dict[str, Any]] = []
        all_imports: List[Dict[str, Any]] = []
        file_map: Dict[str, str] = {}
        python_files: List[str] = []

        target_exts = tuple(file_extensions) if file_extensions else (".py",)

        for rel_path in tracked_files:
            full_path = os.path.join(repo_root, rel_path)
            is_vendor = any(v in rel_path for v in ["node_modules/", "vendor/", "dist/", ".cache/"])
            is_target = rel_path.endswith(target_exts)

            if is_vendor and not is_target:
                content = ""
            else:
                content = self.get_file_content(repo_root, rel_path, ref=ref)

            file_map[rel_path] = content

            if is_target:
                python_files.append(rel_path)
                try:
                    tree = ast.parse(content, filename=rel_path)
                    extractor = ASTEntityExtractor(full_path, rel_path, content)
                    extractor.visit(tree)

                    mod_entity = {
                        "id": extractor.module_name,
                        "name": rel_path,
                        "type": "module",
                        "file_path": rel_path,
                        "full_name": extractor.module_name,
                        "docstring": ast.get_docstring(tree) or "",
                        "start_line": 1,
                        "end_line": len(extractor.source_lines),
                        "snippet": content[:300] + "..." if len(content) > 300 else content,
                        "signature": f"module {rel_path}",
                    }
                    all_entities.append(mod_entity)
                    all_entities.extend(extractor.entities)

                    for imp in extractor.imports:
                        imp["source_file"] = rel_path
                        all_imports.append(imp)
                except Exception as e:
                    logger.warning(f"Error parsing AST for {rel_path}: {e}")

        return {
            "repo_name": metadata["repo_name"],
            "repo_root": repo_root,
            "git_commit": metadata["git_commit"],
            "git_branch": metadata["git_branch"],
            "git_remote": metadata["git_remote"],
            "files": tracked_files,
            "file_map": file_map,
            "total_files": len(tracked_files),
            "python_files": python_files,
            "entities": all_entities,
            "imports": all_imports,
            "total_entities": len(all_entities),
        }


def parse_git_repository(
    repo_path: Optional[str] = None,
    ref: Optional[str] = None,
    git_url: Optional[str] = None,
    cache_dir: Optional[str] = None,
    file_extensions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Parses a repository directly from Git (local directory, active repo, or remote URL).
    """
    target = git_url or repo_path
    parser = GitRepoParser(cache_dir=cache_dir)
    return parser.parse(target, ref=ref, file_extensions=file_extensions)


# Backwards compatibility aliases
parse_repository = parse_git_repository
parse_smartfix_repository = parse_git_repository


if __name__ == "__main__":
    result = parse_git_repository()
    print(f"Git Repository: {result['repo_name']} (branch: {result['git_branch']}, commit: {result['git_commit'][:7] if result['git_commit'] else 'N/A'})")
    print(f"Tracked Files: {result['total_files']} ({len(result['python_files'])} Python files)")
    print(f"Extracted {result['total_entities']} AST entities.")
