"""
REI Code Repository Parser Package.

Exposes the core interfaces and implementations for version control integration,
code entity extraction, and repository parsing orchestration:

- `VCSProvider`: Abstract interface for VCS file and metadata access.
- `GitService`: Concrete VCSProvider implementation for Git repositories.
- `EntityExtractor`: Abstract interface for code symbol and entity extraction.
- `ASTEntityExtractor`: Concrete EntityExtractor implementation using Python AST.
- `TreeSitterExtractor`: Concrete EntityExtractor implementation using Tree-sitter CST.
- `RepositoryOrchestrator`: High-level pipeline coordinator.
- `GitRepoParser`: Backwards-compatible wrapper alias for RepositoryOrchestrator.
- `parse_git_repository`: Functional composition root for repository parsing.
- `parse_repository`: Alias for parse_git_repository.
- `parse_smartfix_repository`: Legacy compatibility alias.
"""

from backend.parser.ast_extractor import ASTEntityExtractor, EntityExtractor
from backend.parser.git_service import GitService, VCSProvider
from backend.parser.repo_orchestrator import RepositoryOrchestrator
from backend.parser.repo_parser import (
    GitRepoParser,
    parse_git_repository,
    parse_repository,
    parse_smartfix_repository,
)
from backend.parser.tree_sitter_extractor import TreeSitterExtractor

__all__ = [
    "VCSProvider",
    "GitService",
    "EntityExtractor",
    "ASTEntityExtractor",
    "TreeSitterExtractor",
    "RepositoryOrchestrator",
    "GitRepoParser",
    "parse_git_repository",
    "parse_repository",
    "parse_smartfix_repository",
]
