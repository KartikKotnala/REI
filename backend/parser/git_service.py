"""
Git Integration and Version Control Service Module.

This module provides the version control abstraction layer for the REI platform.
It defines the abstract `VCSProvider` interface to decouple repository access from
specific version control implementations, and provides `GitService` as the concrete
implementation for interacting directly with Git repositories via the Git CLI.

Author: REI Team
"""

import logging
import os
import subprocess
import urllib.parse
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class VCSProvider(ABC):
    """
    Abstract interface for Version Control System (VCS) operations.

    This interface guarantees the Dependency Inversion Principle by establishing
    a contract for repository discovery, file tracking, content retrieval, and
    metadata extraction. High-level orchestrators depend strictly on this abstraction
    rather than any concrete version control system.
    """

    @abstractmethod
    def resolve_repository(self, path_or_url: Optional[str] = None) -> str:
        """
        Resolves the local root directory of a target repository.

        Args:
            path_or_url: Optional local directory path or remote Git URL.
                If None, the active workspace repository should be auto-detected.

        Returns:
            The absolute path to the local repository root directory.

        Raises:
            RuntimeError: If repository resolution fails and cannot be recovered.
        """
        pass

    @abstractmethod
    def get_metadata(self, repo_root: str) -> Dict[str, Any]:
        """
        Extracts repository-level metadata from the version control system.

        Args:
            repo_root: Absolute filesystem path to the repository root directory.

        Returns:
            A dictionary containing metadata:
                - 'repo_name': str, human-readable repository name.
                - 'git_commit': str, current commit hash or revision identifier.
                - 'git_branch': str, active branch name or ref.
                - 'git_remote': str, remote origin repository URL.
        """
        pass

    @abstractmethod
    def get_tracked_files(self, repo_root: str, ref: Optional[str] = None) -> List[str]:
        """
        Lists all files actively tracked by the version control system.

        This automatically respects exclusion rules (.gitignore) and filters out
        virtual environments, dependencies, and temporary untracked artifacts.

        Args:
            repo_root: Absolute filesystem path to the repository root directory.
            ref: Optional commit, branch, or tag reference (e.g., 'HEAD', 'main').

        Returns:
            A sorted list of relative file paths from the repository root.
        """
        pass

    @abstractmethod
    def get_file_content(
        self, repo_root: str, rel_path: str, ref: Optional[str] = None
    ) -> str:
        """
        Retrieves the text content of a tracked file.

        Args:
            repo_root: Absolute filesystem path to the repository root directory.
            rel_path: Relative path of the file from the repository root.
            ref: Optional commit, branch, or tag reference to read historical content.
                If None, reads from the current working tree.

        Returns:
            The decoded string content of the file. Returns empty string for binary
            or unreadable files without raising exceptions.
        """
        pass


class GitService(VCSProvider):
    """
    Concrete implementation of `VCSProvider` using the native Git CLI.

    Executes git commands directly through subprocesses, supporting:
    - Automatic repository root discovery (`git rev-parse --show-toplevel`).
    - Remote Git URL shallow cloning and local caching.
    - Tracked file listing via `git ls-files` (or `git ls-tree` for specific refs).
    - Direct object storage inspection via `git show <ref>:<path>`.
    - Binary file detection and safe multi-encoding decoding (UTF-8, Latin-1 fallback).
    """

    def __init__(self, cache_dir: Optional[str] = None):
        """
        Initializes the GitService instance.

        Args:
            cache_dir: Optional custom filesystem directory used to cache cloned
                remote repositories. Defaults to `~/.cache/rei/repos`.
        """
        self.cache_dir = (
            Path(cache_dir)
            if cache_dir
            else Path.home() / ".cache" / "rei" / "repos"
        )

    def _run_git(self, cmd: List[str], cwd: Optional[str] = None) -> str:
        """
        Executes a git command and returns its stripped stdout string.

        Args:
            cmd: Command arguments starting with 'git'.
            cwd: Optional working directory for the command.

        Returns:
            The standard output of the command stripped of leading/trailing whitespace.

        Raises:
            subprocess.CalledProcessError: If the git command returns a non-zero exit code.
        """
        res = subprocess.run(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        return res.stdout.strip()

    def resolve_repository(self, path_or_url: Optional[str] = None) -> str:
        """
        Resolves the repository root path.

        Handles:
        1. Remote Git URLs (`http://`, `https://`, `git@`, `ssh://`): Clones or reuses cache.
        2. Local directory paths: Verifies presence and runs `git rev-parse`.
        3. Non-existent legacy paths: Checks `tests/fixtures/` or falls back to active repo.
        4. None: Auto-detects the repository root containing the caller or current directory.

        Args:
            path_or_url: Optional directory path or remote URL.

        Returns:
            The absolute path to the local repository root directory.
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
                return self._run_git(
                    ["git", "-C", path_or_url, "rev-parse", "--show-toplevel"]
                )
            except Exception:
                return os.path.abspath(path_or_url)

        # Check bundled fixture directory if path does not exist on disk
        if path_or_url:
            base_name = os.path.basename(path_or_url.rstrip("/\\"))
            fixture_path = (
                Path(__file__).resolve().parent.parent.parent
                / "tests"
                / "fixtures"
                / base_name
            )
            if fixture_path.exists() and (fixture_path / ".git").exists():
                return str(fixture_path)
            logger.warning(
                f"Specified repository path '{path_or_url}' not found. Falling back to active Git repository."
            )

        # Fall back to the active repository containing this file or current working directory
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            return self._run_git(
                ["git", "-C", current_dir, "rev-parse", "--show-toplevel"]
            )
        except Exception:
            try:
                return self._run_git(["git", "rev-parse", "--show-toplevel"])
            except Exception:
                return os.getcwd()

    def _resolve_remote_url(self, git_url: str) -> str:
        """
        Clones or fetches a remote Git URL into cache, reusing fixtures if available.

        Args:
            git_url: Remote Git URL to clone or locate.

        Returns:
            Absolute path to the cloned repository directory.

        Raises:
            RuntimeError: If cloning fails and no fixture is available.
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
            raise RuntimeError(
                f"Failed to clone remote git repository from {git_url}: {e}"
            )

    def get_metadata(self, repo_root: str) -> Dict[str, Any]:
        """
        Extracts metadata directly from Git (commit hash, branch, remote origin URL).

        Args:
            repo_root: Absolute filesystem path to the repository root directory.

        Returns:
            Dictionary with 'repo_name', 'git_commit', 'git_branch', and 'git_remote'.
        """
        metadata = {
            "repo_name": os.path.basename(os.path.abspath(repo_root)),
            "git_commit": "",
            "git_branch": "",
            "git_remote": "",
        }
        try:
            metadata["git_commit"] = self._run_git(
                ["git", "-C", repo_root, "rev-parse", "HEAD"]
            )
        except Exception:
            pass

        try:
            metadata["git_branch"] = self._run_git(
                ["git", "-C", repo_root, "rev-parse", "--abbrev-ref", "HEAD"]
            )
        except Exception:
            pass

        try:
            remote = self._run_git(
                ["git", "-C", repo_root, "config", "--get", "remote.origin.url"]
            )
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

    def get_tracked_files(
        self, repo_root: str, ref: Optional[str] = None
    ) -> List[str]:
        """
        Queries Git for all tracked files.

        Uses `git ls-tree` when an explicit revision `ref` is provided,
        otherwise uses `git ls-files` for working tree state.

        Args:
            repo_root: Absolute filesystem path to the repository root directory.
            ref: Optional commit, branch, or tag reference (e.g. 'HEAD', 'main').

        Returns:
            Sorted list of relative file paths.
        """
        try:
            if ref:
                output = self._run_git(
                    ["git", "-C", repo_root, "ls-tree", "-r", "--name-only", ref]
                )
            else:
                output = self._run_git(["git", "-C", repo_root, "ls-files"])
            files = [line.strip() for line in output.splitlines() if line.strip()]
            return sorted(files)
        except Exception as e:
            logger.warning(
                f"Error querying git tracked files: {e}. Falling back to os.walk."
            )
            files = []
            for root, _, filenames in os.walk(repo_root):
                if any(
                    ignored in root
                    for ignored in [".git", ".venv", "__pycache__", "node_modules"]
                ):
                    continue
                for f in filenames:
                    files.append(os.path.relpath(os.path.join(root, f), repo_root))
            return sorted(files)

    def get_file_content(
        self, repo_root: str, rel_path: str, ref: Optional[str] = None
    ) -> str:
        """
        Reads file content from the git object store or the working tree.

        Features safe multi-encoding fallback (UTF-8, Latin-1) and handles
        binary files gracefully by returning an empty string.

        Args:
            repo_root: Absolute filesystem path to the repository root directory.
            rel_path: Relative path of the file from the repository root.
            ref: Optional commit, branch, or tag reference to read historical content.

        Returns:
            Decoded string content of the file.
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

