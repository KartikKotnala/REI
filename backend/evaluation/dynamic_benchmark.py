"""
Dynamic Benchmark Scenario Generator for Repository Evolution Intelligence (REI).

Dynamically extracts grounded change-impact evaluation scenarios from:
1. Real historical Git commits and diffs in the active repository (via GitService).
2. Real architectural hub entities and dependency chains in the active graph.

This replaces static hardcoded benchmarks with dynamic, repository-specific ground truth.
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional
import networkx as nx

logger = logging.getLogger(__name__)


class DynamicBenchmarkGenerator:
    """
    Generates dynamic evaluation scenarios with ground-truth labels directly from
    the active repository's version control history and dependency graph.
    """

    def __init__(self, parser_data: Dict[str, Any], nx_graph: nx.DiGraph):
        self.parser_data = parser_data or {}
        self.nx_graph = nx_graph
        self.repo_root = parser_data.get("repo_root", "")
        self.repo_name = parser_data.get("repo_name", "repository")
        self.vcs = None

    def _get_vcs(self):
        if self.vcs is None:
            from backend.parser.git_service import GitService
            self.vcs = GitService()
        return self.vcs

    def generate_scenarios(self, max_scenarios: int = 5) -> List[Dict[str, Any]]:
        """
        Generates dynamic benchmark scenarios tailored to the loaded repository.
        Attempts real git commit history extraction first, falling back to
        architectural graph hub perturbation.
        """
        scenarios = []

        # Strategy 1: Extract from real Git commit history
        if self.repo_root and os.path.exists(self.repo_root):
            try:
                scenarios = self._extract_from_git_history(max_scenarios=max_scenarios)
            except Exception as e:
                logger.warning(f"Git history scenario extraction failed: {e}")
                scenarios = []

        # Strategy 2: If git history yielded fewer than max_scenarios, supplement with Graph Hub perturbations
        if len(scenarios) < max_scenarios and self.nx_graph and len(self.nx_graph.nodes) > 0:
            supplement = self._generate_from_graph_hubs(count=max_scenarios - len(scenarios), existing_scenarios=scenarios)
            scenarios.extend(supplement)

        return scenarios[:max_scenarios]

    def _extract_from_git_history(self, max_scenarios: int = 5) -> List[Dict[str, Any]]:
        vcs = self._get_vcs()
        commits = vcs.get_commit_history(self.repo_root, max_count=30)
        scenarios = []

        for c in commits:
            if len(scenarios) >= max_scenarios:
                break

            changed_files = c.get("files_changed", [])
            py_files = [f for f in changed_files if f.endswith(".py") and not f.startswith("tests/")]

            if not py_files:
                continue

            target_file = py_files[0]
            diff_text = vcs.get_commit_diff(self.repo_root, c["hash"], context_lines=2)
            if not diff_text or len(diff_text.strip()) == 0:
                continue

            # Extract changed symbol name from diff or file
            symbol_name = self._find_symbol_in_diff(diff_text, target_file)
            if not symbol_name:
                continue

            # Match with graph nodes
            matched_node = None
            for n in self.nx_graph.nodes:
                if symbol_name.lower() in n.lower() and (target_file in n or os.path.basename(target_file) in n):
                    matched_node = n
                    break

            if not matched_node:
                for n in self.nx_graph.nodes:
                    if symbol_name.lower() in n.lower():
                        matched_node = n
                        break

            target_symbol = matched_node or f"{target_file.replace('/', '.')}.{symbol_name}"

            # Compute ground truth impacted entities: callers, callees, and co-changed files
            ground_truth = []
            if matched_node and self.nx_graph.has_node(matched_node):
                # Callers / Dependents (predecessors)
                for pred in list(self.nx_graph.predecessors(matched_node))[:4]:
                    ground_truth.append(pred)
                # Callee dependencies (successors)
                for succ in list(self.nx_graph.successors(matched_node))[:3]:
                    ground_truth.append(succ)

            # If ground truth from graph is small, add co-changed entities from other modified files
            if len(ground_truth) < 2:
                for other_f in changed_files:
                    if other_f != target_file:
                        for n in self.nx_graph.nodes:
                            if other_f in n:
                                ground_truth.append(n)
                                break

            # Ensure target symbol itself is included in ground truth context
            if target_symbol not in ground_truth:
                ground_truth.insert(0, target_symbol)

            # Extract clean diff snippet (first 100-200 chars of unified diff)
            diff_lines = [l for l in diff_text.splitlines() if l.startswith("+") or l.startswith("-")][:4]
            diff_snippet = "\n".join(diff_lines) if diff_lines else f"+ def {symbol_name}(*args, **kwargs):\n+     pass"

            scenarios.append({
                "scenario_id": f"GIT_COMMIT_{c.get('short_hash', c['hash'][:7])}",
                "benchmark_version": "v2.0-dynamic",
                "source": "REAL_GIT_COMMIT",
                "commit_hash": c["hash"],
                "title": c.get("message", f"Modification to {symbol_name}"),
                "description": f"Real historical change to '{symbol_name}' in commit {c.get('short_hash', '')}: {c.get('message', '')}",
                "target_symbol": target_symbol,
                "file_path": target_file,
                "diff_snippet": diff_snippet,
                "ground_truth_impacted_entities": list(dict.fromkeys(ground_truth))[:6],
                "ground_truth_count": len(ground_truth),
            })

        return scenarios

    def _find_symbol_in_diff(self, diff_text: str, file_path: str) -> Optional[str]:
        # Regex to find function or class definitions in diff hunks
        match = re.search(r"@@.*@@\s*(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)", diff_text)
        if match:
            return match.group(1)

        # Look for def or class in diff lines
        match2 = re.search(r"^[+-]\s*(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)", diff_text, re.MULTILINE)
        if match2:
            return match2.group(1)

        # Fall back to file stem name
        stem = Path(file_path).stem
        if stem and stem != "__init__":
            return stem

        return None

    def _generate_from_graph_hubs(self, count: int, existing_scenarios: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        existing_targets = {s["target_symbol"] for s in existing_scenarios}
        degrees = dict(self.nx_graph.degree())
        sorted_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)

        scenarios = []
        hub_idx = 1

        for nid, deg in sorted_nodes:
            if len(scenarios) >= count:
                break
            if nid in existing_targets:
                continue

            ndata = self.nx_graph.nodes.get(nid, {})
            ntype = ndata.get("type", "function")
            nname = ndata.get("name", nid.split(".")[-1])
            fpath = ndata.get("file_path", "")

            # Exclude tests or non-core modules if possible
            if "test" in nid.lower() and len(sorted_nodes) > 10:
                continue

            # Ground truth: 1-hop and 2-hop connected graph components
            ground_truth = []
            for pred in self.nx_graph.predecessors(nid):
                ground_truth.append(pred)
            for succ in self.nx_graph.successors(nid):
                ground_truth.append(succ)

            if len(ground_truth) < 2:
                continue

            # Generate realistic diff perturbation snippet
            if ntype == "class":
                diff_snippet = (
                    f"- class {nname}:\n"
                    f"+ class {nname}(BaseComponent):\n"
                    f"+     \"\"\"Updated class signature with dynamic lifecycle hooks.\"\"\""
                )
                action_desc = f"Class inheritance refactoring and lifecycle hook extension on '{nname}'"
            elif ntype == "endpoint":
                diff_snippet = (
                    f"- @route('/{nname.lower()}', methods=['GET'])\n"
                    f"+ @route('/{nname.lower()}', methods=['GET', 'POST'], strict_slashes=False)"
                )
                action_desc = f"HTTP endpoint method contract and schema expansion on '{nname}'"
            else:
                diff_snippet = (
                    f"- def {nname}(self, *args, **kwargs):\n"
                    f"+ def {nname}(self, *args, timeout: Optional[int] = 30, retry: bool = True, **kwargs):"
                )
                action_desc = f"Method signature evolution with timeout & retry parameters on '{nname}'"

            scenarios.append({
                "scenario_id": f"DYN_HUB_{hub_idx}",
                "benchmark_version": "v2.0-dynamic",
                "source": "ARCHITECTURAL_HUB",
                "title": f"Architectural Core Evolution: {nname}",
                "description": f"{action_desc} in '{fpath}'. Propagates through {len(ground_truth)} direct callers and callees.",
                "target_symbol": nid,
                "file_path": fpath,
                "diff_snippet": diff_snippet,
                "ground_truth_impacted_entities": ground_truth[:6],
                "ground_truth_count": len(ground_truth),
            })
            hub_idx += 1

        return scenarios
