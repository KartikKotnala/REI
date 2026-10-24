"""
Tree-sitter Entity Extractor and CST Code Structure Analysis Module.

Provides `TreeSitterExtractor` implementing REI's `EntityExtractor` interface.
Supports multi-language Concrete Syntax Tree (CST) parsing for Python, TypeScript/JavaScript,
Java, C, and Rust using tree-sitter grammars and declarative pattern matching.

Author: REI Team
"""

import logging
import os
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.parser.ast_extractor import ASTEntityExtractor, EntityExtractor

logger = logging.getLogger(__name__)


# Supported language identifier mappings based on file extensions
EXTENSION_TO_LANGUAGE: Dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".rs": "rust",
}


class TreeSitterUnavailableError(ImportError):
    """Raised when tree-sitter or the requested language grammar is not installed."""
    pass


class TreeSitterLanguageManager:
    """
    Manages loading and caching of Tree-sitter Language definitions and Parsers.
    Supports both modern modular wheels (`tree-sitter-python`, etc.) and
    all-in-one meta-packages (`tree-sitter-languages`).
    """

    _parsers: Dict[str, Any] = {}
    _languages: Dict[str, Any] = {}
    _initialized: bool = False
    _backend_type: Optional[str] = None  # 'modular' | 'languages_meta' | None

    @classmethod
    def is_available(cls) -> bool:
        """Checks if any tree-sitter backend is installed."""
        cls._detect_backend()
        return cls._backend_type is not None

    @classmethod
    def _detect_backend(cls) -> None:
        if cls._initialized:
            return

        cls._initialized = True
        try:
            import tree_sitter  # noqa: F401
            cls._backend_type = "modular"
            return
        except ImportError:
            pass

        try:
            import tree_sitter_languages  # noqa: F401
            cls._backend_type = "languages_meta"
            return
        except ImportError:
            pass

        cls._backend_type = None

    @classmethod
    def get_parser(cls, language_name: str) -> Optional[Any]:
        """
        Retrieves or initializes a tree-sitter Parser for the specified language.
        """
        cls._detect_backend()
        if not cls._backend_type:
            return None

        if language_name in cls._parsers:
            return cls._parsers[language_name]

        parser = None

        if cls._backend_type == "modular":
            try:
                from tree_sitter import Language, Parser

                lang_obj = None
                if language_name == "python":
                    import tree_sitter_python
                    lang_obj = Language(tree_sitter_python.language())
                elif language_name in ("typescript", "tsx"):
                    import tree_sitter_typescript
                    lang_func = (
                        tree_sitter_typescript.language_tsx
                        if language_name == "tsx"
                        else tree_sitter_typescript.language_typescript
                    )
                    lang_obj = Language(lang_func())
                elif language_name == "javascript":
                    import tree_sitter_javascript
                    lang_obj = Language(tree_sitter_javascript.language())
                elif language_name == "java":
                    import tree_sitter_java
                    lang_obj = Language(tree_sitter_java.language())
                elif language_name == "c":
                    import tree_sitter_c
                    lang_obj = Language(tree_sitter_c.language())
                elif language_name == "rust":
                    import tree_sitter_rust
                    lang_obj = Language(tree_sitter_rust.language())

                if lang_obj:
                    # In modern tree-sitter (0.22+), Language is passed to Parser
                    try:
                        parser = Parser(lang_obj)
                    except TypeError:
                        parser = Parser()
                        parser.set_language(lang_obj)
                    cls._languages[language_name] = lang_obj
            except Exception as e:
                logger.debug(f"Could not initialize modular tree-sitter parser for '{language_name}': {e}")

        elif cls._backend_type == "languages_meta":
            try:
                import tree_sitter_languages
                parser = tree_sitter_languages.get_parser(language_name)
                cls._languages[language_name] = tree_sitter_languages.get_language(language_name)
            except Exception as e:
                logger.debug(f"Could not initialize tree-sitter-languages parser for '{language_name}': {e}")

        if parser:
            cls._parsers[language_name] = parser

        return parser


class TreeSitterExtractor(EntityExtractor):
    """
    Concrete implementation of `EntityExtractor` using Tree-sitter.

    Extracts fine-grained software entities (classes, interfaces, functions,
    endpoints, variables, attributes, imports, and calls) across multiple
    programming languages from Concrete Syntax Trees (CSTs).

    Features:
    - Multi-language AST/CST processing (Python, TypeScript, JavaScript, Java, C, Rust).
    - Conforms strictly to REI's `EntityExtractor` interface.
    - Gracefully falls back to Python `ASTEntityExtractor` if tree-sitter binaries
      are not yet installed in the target environment and language is Python.
    """

    def __init__(
        self,
        file_path: str,
        relative_path: str,
        source_code: str,
        language: Optional[str] = None,
        fallback_to_ast: bool = True,
    ):
        """
        Initializes the TreeSitterExtractor.

        Args:
            file_path: Absolute filesystem path to the source file.
            relative_path: Repository-relative path to the source file.
            source_code: Raw source code text.
            language: Optional explicit language override (e.g. 'python', 'typescript').
            fallback_to_ast: Whether to fall back to ASTEntityExtractor for Python
                             if tree-sitter is unavailable.
        """
        self._file_path = file_path
        self._relative_path = relative_path
        self._source_code = source_code
        self._source_lines = source_code.splitlines()
        self._source_bytes = source_code.encode("utf-8")
        self._fallback_to_ast = fallback_to_ast

        ext = "." + relative_path.rsplit(".", 1)[-1].lower() if "." in relative_path else ""
        self._language = language or EXTENSION_TO_LANGUAGE.get(ext, "python")
        self._module_name = relative_path.replace("/", ".").replace("\\", ".")
        if ext:
            self._module_name = self._module_name.rstrip(ext)

        self._entities: List[Dict[str, Any]] = []
        self._imports: List[Dict[str, Any]] = []
        self._extracted: bool = False

        self.current_class: Optional[str] = None
        self.current_function: Optional[str] = None

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
        """Canonical module name derived from relative path."""
        return self._module_name

    @property
    def language(self) -> str:
        """Target programming language."""
        return self._language

    def _get_snippet(self, start_line: int, end_line: int) -> str:
        """Extracts source lines (1-indexed inclusive)."""
        lines = self._source_lines[start_line - 1 : end_line]
        return "\n".join(lines)

    def extract(self) -> List[Dict[str, Any]]:
        """
        Executes the extraction process using Tree-sitter CST parsing.

        Returns:
            List of entity dictionaries conforming to REI schema.
        """
        if self._extracted:
            return self._entities

        parser = TreeSitterLanguageManager.get_parser(self._language)

        if not parser:
            if self._fallback_to_ast and self._language == "python":
                logger.debug(
                    f"Tree-sitter parser not found for '{self._language}', falling back to ASTEntityExtractor for '{self._relative_path}'"
                )
                fallback = ASTEntityExtractor(
                    self._file_path, self._relative_path, self._source_code
                )
                self._entities = fallback.extract()
                self._imports = fallback.imports
                self._extracted = True
                return self._entities
            else:
                raise TreeSitterUnavailableError(
                    f"Tree-sitter parser for language '{self._language}' is not installed. "
                    f"Install via: pip install tree-sitter tree-sitter-{self._language} or pip install tree-sitter-languages"
                )

        try:
            tree = parser.parse(self._source_bytes)
            root_node = tree.root_node
            self._walk_node(root_node)
        except Exception as e:
            logger.warning(
                f"Tree-sitter parsing error in file '{self._relative_path}': {e}"
            )

        self._extracted = True
        return self._entities

    def _walk_node(self, node: Any) -> None:
        """
        Recursively walks CST nodes and extracts typed software entities.
        Dispatches to language-specific handler based on node types.
        """
        ntype = node.type

        # Dispatch based on CST node type
        if ntype in ("class_definition", "class_declaration", "interface_declaration"):
            self._handle_class_node(node)
        elif ntype in (
            "function_definition",
            "function_declaration",
            "method_definition",
            "arrow_function",
        ):
            self._handle_function_node(node)
        elif ntype in ("import_statement", "import_from_statement"):
            self._handle_import_node(node)
        elif ntype in ("assignment", "variable_declaration", "lexical_declaration"):
            self._handle_assignment_node(node)
        else:
            # Continue traversing child nodes
            for child in node.children:
                self._walk_node(child)

    def _get_node_text(self, node: Any) -> str:
        """Extracts UTF-8 decoded source slice for a given CST node."""
        if not node:
            return ""
        return self._source_bytes[node.start_byte : node.end_byte].decode("utf-8", errors="replace")

    def _handle_class_node(self, node: Any) -> None:
        """Extracts class/interface definitions, bases, and scopes."""
        class_name = ""
        bases: List[str] = []

        # Find class name
        name_node = node.child_by_field_name("name")
        if name_node:
            class_name = self._get_node_text(name_node)
        else:
            for child in node.children:
                if child.type in ("identifier", "type_identifier"):
                    class_name = self._get_node_text(child)
                    break

        if not class_name:
            return

        # Find inheritance bases
        superclasses_node = node.child_by_field_name("superclasses") or node.child_by_field_name("heritage")
        if superclasses_node:
            bases_text = self._get_node_text(superclasses_node).strip("()")
            bases = [b.strip() for b in bases_text.split(",") if b.strip()]

        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        full_name = f"{self._module_name}.{class_name}"

        # Extract docstring if present (first string expression in block)
        docstring = self._extract_docstring(node)

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
            "parent_class": self.current_class,
            "signature": f"class {class_name}({', '.join(bases)})" if bases else f"class {class_name}",
        }
        self._entities.append(entity)

        # Walk children with updated class scope
        prev_class = self.current_class
        self.current_class = class_name
        body_node = node.child_by_field_name("body")
        if body_node:
            for child in body_node.children:
                self._walk_node(child)
        else:
            for child in node.children:
                if child.type not in ("identifier", "type_identifier"):
                    self._walk_node(child)
        self.current_class = prev_class

    def _handle_function_node(self, node: Any, is_async: bool = False) -> None:
        """Extracts function, method, and endpoint entities with internal call tracing."""
        func_name = ""
        name_node = node.child_by_field_name("name")
        if name_node:
            func_name = self._get_node_text(name_node)
        else:
            for child in node.children:
                if child.type in ("identifier", "property_identifier"):
                    func_name = self._get_node_text(child)
                    break

        if not func_name:
            return

        # Check for async modifier
        if any(child.type == "async" for child in node.children):
            is_async = True

        if self.current_class:
            full_name = f"{self._module_name}.{self.current_class}.{func_name}"
        else:
            full_name = f"{self._module_name}.{func_name}"

        params_node = node.child_by_field_name("parameters")
        params_str = self._get_node_text(params_node) if params_node else "()"
        signature = f"{'async ' if is_async else ''}def {func_name}{params_str}"

        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        docstring = self._extract_docstring(node)

        # Detect REST endpoint decorators
        endpoint_info = self._check_endpoint_decorator(node)

        # Collect internal calls and variable usages within function body
        calls: Set[str] = set()
        variables_used: Set[str] = set()
        attributes_used: Set[str] = set()

        body_node = node.child_by_field_name("body")
        if body_node:
            self._collect_calls_and_vars(body_node, calls, variables_used, attributes_used)

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
            "calls": list(calls),
            "variables_used": list(variables_used),
            "attributes_used": list(attributes_used),
            "endpoint_info": endpoint_info,
        }
        self._entities.append(entity)

        # Continue traversing child scope
        prev_func = self.current_function
        self.current_function = func_name
        if body_node:
            for child in body_node.children:
                if child.type in ("function_definition", "class_definition"):
                    self._walk_node(child)
        self.current_function = prev_func

    def _collect_calls_and_vars(
        self, node: Any, calls: Set[str], variables_used: Set[str], attributes_used: Set[str]
    ) -> None:
        """Recursively inspects statements for calls, identifiers, and attributes."""
        ntype = node.type

        if ntype in ("call", "call_expression"):
            func_node = node.child_by_field_name("function")
            if func_node:
                call_text = self._get_node_text(func_node)
                # If method call obj.method(), extract method name
                if "." in call_text:
                    calls.add(call_text.split(".")[-1])
                else:
                    calls.add(call_text)
        elif ntype in ("attribute", "member_expression"):
            prop_node = node.child_by_field_name("attribute") or node.child_by_field_name("property")
            if prop_node:
                attributes_used.add(self._get_node_text(prop_node))
        elif ntype in ("identifier",):
            var_name = self._get_node_text(node)
            if var_name not in {"self", "cls", "true", "false", "none", "null", "undefined"}:
                variables_used.add(var_name)

        for child in node.children:
            self._collect_calls_and_vars(child, calls, variables_used, attributes_used)

    def _check_endpoint_decorator(self, node: Any) -> Optional[Dict[str, Any]]:
        """Checks parent decorated_definition node for REST route decorators."""
        parent = node.parent
        if parent and parent.type == "decorated_definition":
            for child in parent.children:
                if child.type == "decorator":
                    dec_text = self._get_node_text(child)
                    if any(m in dec_text.lower() for m in ["get", "post", "put", "delete", "patch"]):
                        return {
                            "decorator": dec_text,
                            "is_endpoint": True,
                        }
        return None

    def _extract_docstring(self, node: Any) -> str:
        """Extracts leading string literal from class/function body."""
        body = node.child_by_field_name("body")
        if body and body.children:
            first_stmt = body.children[0]
            if first_stmt.type in ("expression_statement",):
                for sub in first_stmt.children:
                    if sub.type in ("string", "string_literal"):
                        raw = self._get_node_text(sub)
                        return raw.strip("\"' \n\t")
        return ""

    def _handle_import_node(self, node: Any) -> None:
        """Extracts imports into REI import specification dictionaries."""
        ntype = node.type
        text = self._get_node_text(node)

        if ntype == "import_statement":
            # e.g., import os, sys as s
            for child in node.children:
                if child.type == "dotted_name":
                    self._imports.append(
                        {
                            "type": "import",
                            "name": self._get_node_text(child),
                            "asname": None,
                            "source_file": self._relative_path,
                        }
                    )
        elif ntype == "import_from_statement":
            # e.g., from os import path as p
            module_node = node.child_by_field_name("module_name")
            module = self._get_node_text(module_node) if module_node else ""
            self._imports.append(
                {
                    "type": "from_import",
                    "module": module,
                    "name": text,
                    "asname": None,
                    "source_file": self._relative_path,
                }
            )

    def _handle_assignment_node(self, node: Any) -> None:
        """Extracts variable and attribute definitions."""
        scope = self.current_function or self.current_class or "module"
        left_node = node.child_by_field_name("left") or (node.children[0] if node.children else None)
        if not left_node:
            return

        var_name = self._get_node_text(left_node)
        if not var_name or var_name in {"self", "cls", "_", "i"}:
            return

        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1

        is_attr = "self." in var_name or (left_node.type in ("attribute", "member_expression"))
        clean_name = var_name.replace("self.", "")

        full_name = f"{self._module_name}.{scope}.{clean_name}" if scope != "module" else f"{self._module_name}.{clean_name}"

        entity = {
            "id": full_name,
            "name": clean_name,
            "type": "attribute" if is_attr else "variable",
            "file_path": self._relative_path,
            "full_name": full_name,
            "scope": scope,
            "docstring": "",
            "start_line": start_line,
            "end_line": end_line,
            "snippet": self._get_snippet(start_line, end_line),
            "signature": f"self.{clean_name}" if is_attr else clean_name,
        }
        self._entities.append(entity)

