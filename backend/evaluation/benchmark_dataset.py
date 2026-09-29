"""
Controlled Change Scenarios for Software Change-Impact Analysis Evaluation.

Defines 5 ground-truth benchmark change scenarios pinned to version v1.0.0.
These scenarios target core architectural interfaces and propagation paths across
the repository, providing reproducible ground-truth labels for evaluating
Static Dependency RAG and Hybrid Multi-Agent Impact Analysis.

Author: REI Team
Version: v1.0.0
"""

from typing import Any, Dict, List

BENCHMARK_VERSION: str = "v1.0.0"
TARGET_TESTBED: str = "SmartFix Controlled Benchmark Testbed (v1.0.0)"

SMARTFIX_BENCHMARK_SCENARIOS: List[Dict[str, Any]] = [
    {
        "scenario_id": "SCENARIO_1",
        "benchmark_version": BENCHMARK_VERSION,
        "title": "Orchestrator Parse Pipeline Refactoring",
        "description": "Modifying RepositoryOrchestrator.parse() signature to include caching flag.",
        "target_symbol": "backend.parser.repo_orchestrator.RepositoryOrchestrator.parse",
        "file_path": "backend/parser/repo_orchestrator.py",
        "diff_snippet": "- def parse(self, path_or_url: Optional[str] = None):\n+ def parse(self, path_or_url: Optional[str] = None, enable_caching: bool = True):",
        "ground_truth_impacted_entities": [
            "backend.parser.repo_parser.parse_git_repository",
            "backend.parser.repo_orchestrator.RepositoryOrchestrator",
            "backend.parser.git_service.VCSProvider.get_metadata",
            "backend.parser.ast_extractor.ASTEntityExtractor.extract",
        ],
    },
    {
        "scenario_id": "SCENARIO_2",
        "benchmark_version": BENCHMARK_VERSION,
        "title": "Vector Search Query Scoring Modification",
        "description": "Modifying VectorKnowledgeBase.search() to add a minimum similarity threshold parameter.",
        "target_symbol": "backend.vector_db.knowledge_base.VectorKnowledgeBase.search",
        "file_path": "backend/vector_db/knowledge_base.py",
        "diff_snippet": "- def search(self, query: str, top_k: int = 5):\n+ def search(self, query: str, top_k: int = 5, min_score: float = 0.05):",
        "ground_truth_impacted_entities": [
            "backend.main.search_vector_kb",
            "backend.architectures.simulator.REIArchitectureSimulator.run_static_rag",
            "backend.vector_db.knowledge_base.build_smartfix_vector_kb",
            "backend.vector_db.knowledge_base.VectorKnowledgeBase",
        ],
    },
    {
        "scenario_id": "SCENARIO_3",
        "benchmark_version": BENCHMARK_VERSION,
        "title": "Dependency Graph Edge Builder Optimization",
        "description": "Updating DependencyGraphBuilder.build_graph() to compute multi-relational edges with depth limits.",
        "target_symbol": "backend.graph.dependency_graph.DependencyGraphBuilder.build_graph",
        "file_path": "backend/graph/dependency_graph.py",
        "diff_snippet": "- def build_graph(self) -> nx.DiGraph:\n+ def build_graph(self, include_transitive: bool = False) -> nx.DiGraph:",
        "ground_truth_impacted_entities": [
            "backend.graph.dependency_graph.build_smartfix_dependency_graph",
            "backend.architectures.simulator.REIArchitectureSimulator.__init__",
            "backend.graph.dependency_graph.DependencyGraphBuilder",
        ],
    },
    {
        "scenario_id": "SCENARIO_4",
        "benchmark_version": BENCHMARK_VERSION,
        "title": "AST Entity Extraction Method Signature Update",
        "description": "Modifying ASTEntityExtractor.extract() signature to enforce strict syntax validation mode.",
        "target_symbol": "backend.parser.ast_extractor.ASTEntityExtractor.extract",
        "file_path": "backend/parser/ast_extractor.py",
        "diff_snippet": "- def extract(self) -> List[Dict[str, Any]]:\n+ def extract(self, strict_mode: bool = False) -> List[Dict[str, Any]]:",
        "ground_truth_impacted_entities": [
            "backend.parser.repo_orchestrator.RepositoryOrchestrator.parse",
            "backend.parser.ast_extractor.ASTEntityExtractor",
            "backend.parser.ast_extractor.EntityExtractor.extract",
        ],
    },
    {
        "scenario_id": "SCENARIO_5",
        "benchmark_version": BENCHMARK_VERSION,
        "title": "Static RAG Architecture Execution Tuning",
        "description": "Adding timeout and fusion threshold parameters to REIArchitectureSimulator.run_static_rag().",
        "target_symbol": "backend.architectures.simulator.REIArchitectureSimulator.run_static_rag",
        "file_path": "backend/architectures/simulator.py",
        "diff_snippet": "- def run_static_rag(self, req: StaticRAGRequest):\n+ def run_static_rag(self, req: StaticRAGRequest, timeout_ms: int = 5000):",
        "ground_truth_impacted_entities": [
            "backend.architectures.simulator.REIArchitectureSimulator.run_hybrid_intelligent_analysis",
            "backend.main.simulate_static_rag",
            "backend.architectures.simulator.REIArchitectureSimulator",
        ],
    },
]

BENCHMARK_SCENARIOS = SMARTFIX_BENCHMARK_SCENARIOS


def get_benchmark_scenarios() -> List[Dict[str, Any]]:
    """
    Returns the controlled benchmark change scenarios pinned to version v1.0.0.

    Returns:
        List of scenario dictionaries containing target_symbol, file_path, diff_snippet,
        and ground_truth_impacted_entities.
    """
    return BENCHMARK_SCENARIOS


def get_benchmark_metadata() -> Dict[str, Any]:
    """
    Returns benchmark suite metadata.

    Returns:
        Dictionary containing benchmark version, testbed identifier, and scenario count.
    """
    return {
        "version": BENCHMARK_VERSION,
        "testbed": TARGET_TESTBED,
        "total_scenarios": len(BENCHMARK_SCENARIOS),
    }
