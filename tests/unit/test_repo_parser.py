"""
Unit tests for Git-based repository parser (backend/parser/repo_parser.py).
Tests extraction of repository metadata, tracked files, AST entities, and
verifies against the static demo repository: https://github.com/Karanveer-Tinna/docker-first-site.
"""

import os
import unittest
from pathlib import Path
from backend.parser.repo_parser import (
    GitRepoParser,
    parse_git_repository,
    parse_smartfix_repository,
)

DEMO_REPO_URL = "https://github.com/Karanveer-Tinna/docker-first-site"
DEMO_REPO_EXPECTED_COMMIT = "a457bad31703b87b92ee787222a3c54c76f01bb3"
DEMO_REPO_EXPECTED_BRANCH = "master"
DEMO_REPO_EXPECTED_FILES = ["Dockerfile", "README.md", "index.html"]


class TestDemoRepoParser(unittest.TestCase):
    """
    Test suite for parsing the static demo repository:
    https://github.com/Karanveer-Tinna/docker-first-site
    """

    @classmethod
    def setUpClass(cls):
        # Parse the demo repository once for all tests in this class
        cls.result = parse_git_repository(DEMO_REPO_URL)

    def test_repository_metadata(self):
        """Verify repository name, remote URL, branch, and commit hash."""
        self.assertEqual(self.result["repo_name"], "docker-first-site")
        self.assertEqual(self.result["git_branch"], DEMO_REPO_EXPECTED_BRANCH)
        self.assertEqual(self.result["git_commit"], DEMO_REPO_EXPECTED_COMMIT)
        self.assertIn("docker-first-site", self.result["git_remote"])

    def test_tracked_files_list(self):
        """Verify the exact set and count of tracked files in the demo repository."""
        self.assertEqual(self.result["total_files"], 3)
        self.assertEqual(sorted(self.result["files"]), sorted(DEMO_REPO_EXPECTED_FILES))

    def test_dockerfile_content(self):
        """Verify Dockerfile contents parsed directly from the repository."""
        self.assertIn("Dockerfile", self.result["file_map"])
        dockerfile_code = self.result["file_map"]["Dockerfile"]
        self.assertIn("FROM nginx:alpine", dockerfile_code)
        self.assertIn("WORKDIR /usr/share/nginx/html", dockerfile_code)
        self.assertIn("COPY . .", dockerfile_code)
        self.assertIn("EXPOSE 80", dockerfile_code)

    def test_index_html_content(self):
        """Verify index.html contents parsed directly from the repository."""
        self.assertIn("index.html", self.result["file_map"])
        html_code = self.result["file_map"]["index.html"]
        self.assertIn("<h1>Third Version from inside a container</h1>", html_code)
        self.assertIn("<p>Added Docker Installation Guide.</p>", html_code)
        self.assertIn("Installation Guide", html_code)

    def test_readme_content(self):
        """Verify README.md contents parsed directly from the repository."""
        self.assertIn("README.md", self.result["file_map"])
        readme_code = self.result["file_map"]["README.md"]
        self.assertIn(
            "Respository for checking the changes reflected in the docker and websites",
            readme_code,
        )

    def test_python_and_ast_entities_count(self):
        """Verify that a repository with no python files correctly yields 0 AST entities."""
        self.assertEqual(len(self.result["python_files"]), 0)
        self.assertEqual(self.result["total_entities"], 0)
        self.assertEqual(self.result["entities"], [])
        self.assertEqual(self.result["imports"], [])


class TestLocalGitRepositoryParser(unittest.TestCase):
    """
    Test suite for parsing the current active repository (REI).
    """

    @classmethod
    def setUpClass(cls):
        cls.result = parse_git_repository()

    def test_local_repo_metadata(self):
        """Verify local repository identification."""
        self.assertEqual(self.result["repo_name"], "REI")
        self.assertEqual(self.result["git_branch"], "main")
        self.assertEqual(len(self.result["git_commit"]), 40)
        self.assertTrue(os.path.isdir(self.result["repo_root"]))

    def test_python_files_extracted(self):
        """Verify that tracked Python files in REI are discovered and parsed."""
        self.assertGreater(len(self.result["python_files"]), 0)
        # Check that core backend files are among the tracked python files
        expected_py_files = [
            "backend/parser/repo_parser.py",
            "backend/graph/dependency_graph.py",
            "backend/vector_db/knowledge_base.py",
            "backend/main.py",
        ]
        for py_file in expected_py_files:
            self.assertIn(py_file, self.result["python_files"])

    def test_ast_entities_extracted(self):
        """Verify AST entities (classes, functions, modules, variables) are extracted."""
        self.assertGreater(self.result["total_entities"], 200)

        # Verify presence of specific classes and functions
        entity_ids = {e["id"] for e in self.result["entities"]}
        self.assertIn("backend.parser.repo_parser.GitRepoParser", entity_ids)
        self.assertIn("backend.parser.repo_parser.ASTEntityExtractor", entity_ids)
        self.assertIn("backend.parser.repo_parser.parse_git_repository", entity_ids)

    def test_entity_types_variety(self):
        """Verify that various entity types are parsed."""
        entity_types = {e["type"] for e in self.result["entities"]}
        self.assertIn("module", entity_types)
        self.assertIn("class", entity_types)
        self.assertIn("function", entity_types)
        self.assertIn("variable", entity_types)

    def test_imports_extracted(self):
        """Verify import statements are collected with source_file."""
        self.assertGreater(len(self.result["imports"]), 0)
        sample_import = self.result["imports"][0]
        self.assertIn("type", sample_import)
        self.assertIn("source_file", sample_import)


class TestParserGitRefAndCompatibility(unittest.TestCase):
    """
    Test suite for git ref inspection and backwards compatibility.
    """

    def test_parse_with_head_ref(self):
        """Verify parsing with explicit ref='HEAD' reads directly from git object store."""
        result = parse_git_repository(ref="HEAD")
        self.assertGreater(result["total_files"], 0)
        self.assertGreater(result["total_entities"], 0)
        self.assertIn("backend/parser/repo_parser.py", result["file_map"])
        self.assertIn("ASTEntityExtractor", result["file_map"]["backend/parser/repo_parser.py"])

    def test_backwards_compatibility_legacy_path_fallback(self):
        """Verify parse_smartfix_repository with nonexistent legacy path falls back gracefully."""
        legacy_path = "/Users/kartikkotnala/Desktop/SmartFix"
        result = parse_smartfix_repository(legacy_path)
        self.assertIsNotNone(result)
        self.assertEqual(result["repo_name"], "REI")
        self.assertGreater(result["total_entities"], 0)

    def test_backwards_compatibility_no_args(self):
        """Verify parse_smartfix_repository() with no arguments defaults to current git repo."""
        result = parse_smartfix_repository()
        self.assertIsNotNone(result)
        self.assertEqual(result["repo_name"], "REI")
        self.assertGreater(result["total_entities"], 0)


if __name__ == "__main__":
    unittest.main()
