"""
Repository Parser Module for SmartFix Controlled Synthetic Repository.
Extracts fine-grained entities: Functions, Classes, Variables, Attributes, Modules, and REST Endpoints.
"""

import ast
import os
from typing import List, Dict, Any, Optional

SMARTFIX_PATH = "/Users/kartikkotnala/Desktop/SmartFix"


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


def parse_smartfix_repository(repo_path: str = SMARTFIX_PATH) -> Dict[str, Any]:
    """
    Parses all python files in SmartFix repository and returns structured entities and modules.
    """
    all_entities: List[Dict[str, Any]] = []
    all_imports: List[Dict[str, Any]] = []
    file_map: Dict[str, str] = {}

    for root, _, files in os.walk(repo_path):
        if ".venv" in root or ".git" in root or "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, repo_path)
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        code = f.read()

                    file_map[rel_path] = code
                    tree = ast.parse(code, filename=rel_path)
                    extractor = ASTEntityExtractor(full_path, rel_path, code)
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
                        "snippet": code[:300] + "..." if len(code) > 300 else code,
                        "signature": f"module {rel_path}",
                    }
                    all_entities.append(mod_entity)
                    all_entities.extend(extractor.entities)

                    for imp in extractor.imports:
                        imp["source_file"] = rel_path
                        all_imports.append(imp)
                except Exception as e:
                    print(f"Error parsing {rel_path}: {e}")

    return {
        "entities": all_entities,
        "imports": all_imports,
        "total_files": len(file_map),
        "total_entities": len(all_entities),
    }


if __name__ == "__main__":
    result = parse_smartfix_repository()
    print(f"Successfully parsed {result['total_files']} Python files in SmartFix!")
    print(f"Extracted {result['total_entities']} AST entities.")
