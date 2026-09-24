"""
AST Entity Extractor and Code Structure Analysis Module.

This module provides the code analysis abstraction layer for the REI platform.
It defines the abstract `EntityExtractor` interface to establish a contract for
extracting code symbols and dependencies from source files, and provides
`ASTEntityExtractor` as the concrete implementation using Python's native `ast` library.

Author: REI Team
"""

import ast
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class EntityExtractor(ABC):
    """
    Abstract interface for code entity extraction.

    This interface guarantees the Dependency Inversion Principle by establishing
    a standard contract for extracting typed code symbols (classes, functions,
    endpoints, variables, attributes) and module-level dependencies (imports)
    from source code. High-level orchestrators depend strictly on this abstraction,
    allowing arbitrary extractors (e.g. Tree-Sitter, Language Servers, Regex) to be plugged in.
    """

    @abstractmethod
    def extract(self) -> List[Dict[str, Any]]:
        """
        Executes the extraction process on the source code.

        Returns:
            A list of dictionary representations of all extracted software entities.
        """
        pass

    @property
    @abstractmethod
    def entities(self) -> List[Dict[str, Any]]:
        """
        Returns the list of all extracted software entities.

        Returns:
            List of entity dictionaries conforming to the REI entity schema.
        """
        pass

    @property
    @abstractmethod
    def imports(self) -> List[Dict[str, Any]]:
        """
        Returns the list of all extracted import statements and module dependencies.

        Returns:
            List of import dictionaries with 'type', 'name', 'module', 'asname', and 'source_file'.
        """
        pass

    @property
    @abstractmethod
    def module_name(self) -> str:
        """
        Returns the canonical module identifier derived from the file path.

        Returns:
            Dot-delimited module name (e.g., 'backend.parser.repo_parser').
        """
        pass


class ASTEntityExtractor(ast.NodeVisitor, EntityExtractor):
    """
    Concrete implementation of `EntityExtractor` using Python's native `ast` library.

    Walks the Abstract Syntax Tree of a Python source file to extract:
    - **Classes**: Class name, inheritance bases, docstrings, method declarations.
    - **Functions & Methods**: Signatures, argument specs, docstrings, async flags,
      internal function calls, variables used, and object attributes accessed.
    - **REST Endpoints**: FastAPI/Flask route decorators (@app.get, @app.post, etc.).
    - **Variables**: Module-level, class-level, and local scope assignments.
    - **Attributes**: Object attributes (`self.x`).
    - **Imports**: Both standard `import x` and `from x import y` statements.
    """

    def __init__(self, file_path: str, relative_path: str, source_code: str):
        """
        Initializes the ASTEntityExtractor.

        Args:
            file_path: Absolute filesystem path to the Python file.
            relative_path: Repository-relative path to the Python file.
            source_code: Raw text content of the Python file.
        """
        self._file_path = file_path
        self._relative_path = relative_path
        self._source_code = source_code
        self._source_lines = source_code.splitlines()

        self._module_name = relative_path.replace("/", ".").rstrip(".py")
        self._entities: List[Dict[str, Any]] = []
        self._imports: List[Dict[str, Any]] = []

        self.current_class: Optional[str] = None
        self.current_function: Optional[str] = None
        self._extracted = False

    @property
    def entities(self) -> List[Dict[str, Any]]:
        """List of all extracted code entities."""
        return self._entities

    @property
    def imports(self) -> List[Dict[str, Any]]:
        """List of all collected import dependency records."""
        return self._imports

    @property
    def module_name(self) -> str:
        """Canonical dot-delimited module name."""
        return self._module_name

    @property
    def source_lines(self) -> List[str]:
        """Source lines of the parsed file."""
        return self._source_lines

    def _get_snippet(self, start_line: int, end_line: int) -> str:
        """Extracts the slice of source code between 1-indexed line numbers."""
        lines = self._source_lines[start_line - 1 : end_line]
        return "\n".join(lines)

    def extract(self) -> List[Dict[str, Any]]:
        """
        Parses the source code AST and runs the entity visitor.

        Returns:
            The list of extracted entities.
        """
        if not self._extracted:
            try:
                tree = ast.parse(self._source_code, filename=self._relative_path)
                self.visit(tree)
            except Exception as e:
                logger.warning(
                    f"AST parsing error in file '{self._relative_path}': {e}"
                )
            self._extracted = True
        return self._entities

    def visit_Import(self, node: ast.Import):
        """Extracts standard 'import x' statements."""
        for alias in node.names:
            self._imports.append(
                {
                    "type": "import",
                    "name": alias.name,
                    "asname": alias.asname,
                    "source_file": self._relative_path,
                }
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        """Extracts 'from x import y' statements."""
        module = node.module or ""
        for alias in node.names:
            self._imports.append(
                {
                    "type": "from_import",
                    "module": module,
                    "name": alias.name,
                    "asname": alias.asname,
                    "source_file": self._relative_path,
                }
            )
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        """Extracts class definitions, inheritance bases, and docstrings."""
        class_name = node.name
        full_name = f"{self._module_name}.{class_name}"
        bases = [ast.unparse(b) for b in node.bases]
        docstring = ast.get_docstring(node) or ""
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": class_name,
            "type": "class",
            "file_path": self._relative_path,
            "full_name": full_name,
            "docstring": docstring,
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "bases": bases,
            "parent_class": None,
            "signature": (
                f"class {class_name}({', '.join(bases)})"
                if bases
                else f"class {class_name}"
            ),
        }
        self._entities.append(entity)

        prev_class = self.current_class
        self.current_class = class_name
        self.generic_visit(node)
        self.current_class = prev_class

    def visit_FunctionDef(self, node: ast.FunctionDef):
        """Extracts synchronous function and method definitions."""
        self._handle_function(node, is_async=False)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        """Extracts asynchronous function and method definitions."""
        self._handle_function(node, is_async=True)

    def _handle_function(self, node, is_async: bool = False):
        """Handles function entity creation, argument extraction, and endpoint detection."""
        func_name = node.name
        if self.current_class:
            full_name = f"{self._module_name}.{self.current_class}.{func_name}"
        else:
            full_name = f"{self._module_name}.{func_name}"

        docstring = ast.get_docstring(node) or ""
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)
        args_str = ast.unparse(node.args)
        signature = f"{'async ' if is_async else ''}def {func_name}({args_str})"

        # Check for FastAPI / REST endpoint decorators
        endpoint_info = None
        for decorator in node.decorator_list:
            dec_str = ast.unparse(decorator)
            if any(
                method in dec_str
                for method in ["get", "post", "put", "delete", "patch"]
            ):
                endpoint_info = {
                    "decorator": dec_str,
                    "is_endpoint": True,
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
            "file_path": self._relative_path,
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
        self._entities.append(entity)

        prev_func = self.current_function
        self.current_function = func_name
        self.generic_visit(node)
        self.current_function = prev_func

    def visit_Assign(self, node: ast.Assign):
        """Extracts variable assignments."""
        self._handle_assign(node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign):
        """Extracts type-annotated variable assignments."""
        if isinstance(node.target, ast.Name):
            var_name = node.target.id
            self._record_variable(var_name, node, ast.unparse(node.annotation))
        self.generic_visit(node)

    def _handle_assign(self, node: ast.Assign):
        """Records variables or object attributes from an assignment target."""
        for target in node.targets:
            if isinstance(target, ast.Name):
                self._record_variable(target.id, node)
            elif isinstance(target, ast.Attribute):
                if self.current_class:
                    attr_name = target.attr
                    self._record_attribute(attr_name, node)

    def _record_variable(
        self, var_name: str, node: ast.AST, type_hint: str = ""
    ):
        """Filters noisy variable names and constructs a variable entity."""
        if var_name in {"_", "i", "e", "self", "cls"}:
            return
        scope = self.current_function or self.current_class or "module"
        full_name = (
            f"{self._module_name}.{scope}.{var_name}"
            if scope != "module"
            else f"{self._module_name}.{var_name}"
        )

        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": var_name,
            "type": "variable",
            "file_path": self._relative_path,
            "full_name": full_name,
            "scope": scope,
            "docstring": "",
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "signature": f"{var_name}: {type_hint}" if type_hint else var_name,
        }
        self._entities.append(entity)

    def _record_attribute(self, attr_name: str, node: ast.AST):
        """Constructs an object attribute entity (self.attr)."""
        full_name = f"{self._module_name}.{self.current_class}.{attr_name}"
        start_line = node.lineno
        end_line = getattr(node, "end_lineno", start_line)

        entity = {
            "id": full_name,
            "name": attr_name,
            "type": "attribute",
            "file_path": self._relative_path,
            "full_name": full_name,
            "scope": self.current_class,
            "docstring": "",
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "signature": f"self.{attr_name}",
        }
        self._entities.append(entity)

