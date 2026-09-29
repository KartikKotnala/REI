# Repository Evolution Intelligence (REI)
## Technical Specification & Research Documentation

---

## 1. Executive Summary

Modern software applications are built as complex webs of functions, classes, data schemas, and loosely-coupled microservices. When source code evolves—through feature additions, performance refactoring, or bug fixes—localized modifications can produce unexpected ripple effects across upstream and downstream components.

Conventional change-impact analysis (CIA) relies either on:
* **Static Call Graphs**: Exact and deterministic, but strictly limited to direct in-process invocations. They are blind to implicit semantic couplings such as shared database representations, dynamic dispatch, state side-effects, and cross-process HTTP boundaries.
* **Lexical Text Search (`grep`)**: High recall, but produces an unmanageable volume of false positives due to a complete absence of syntactic and topological context.

**Repository Evolution Intelligence (REI)** investigates whether combining **Abstract Syntax Tree (AST) Dependency Knowledge Graphs**, **Dense Semantic Code Retrieval (Vector RAG)**, and **Specialized Sub-13B Large Language Models (LLMs)** can overcome these limitations.

---

## 2. Research Questions (RQs)

* **RQ1 (Semantic Discovery)**: Can dense vector retrieval identify relevant, implicit software dependencies that traditional static call graphs overlook?
* **RQ2 (Architecture Comparison)**: How does a sequential pipeline (Static Dependency + RAG) compare against an autonomous, multi-agent orchestration architecture in terms of precision, recall, and ranking quality?
* **RQ3 (Resource & Parameter Feasibility)**: Can specialized, lightweight models constrained to $\le 13\text{B}$ parameters provide competitive impact reasoning while remaining suitable for on-premise, local developer workstations?

---

## 3. System Architecture & Core Modules

The system is decomposed into four foundational layers:

### 3.1. Fine-Grained AST Parser & Modular Inversion Engine (`backend/parser/`)
Built with a modular Dependency Inversion Principle (DIP) architecture across specialized components:
* **VCS Integration (`backend/parser/git_service.py`)**: Defines the abstract `VCSProvider` interface and concrete `GitService` implementing repository discovery, branch/commit resolution, tracked file filtering, and encoding-safe file content streaming.
* **AST Entity Extractor (`backend/parser/ast_extractor.py`)**: Defines the abstract `EntityExtractor` interface and concrete `ASTEntityExtractor` utilizing Python's native `ast` library to walk abstract syntax trees and extract typed software entities:
  * **Functions & Methods**: Name, signature, docstring, body snippet, line range, local/global variable references, internal function calls, and async flags.
  * **Classes**: Class name, inheritance bases, docstrings, methods, and attributes.
  * **Variables**: Module-level, class-level, and local scope variables.
  * **Attributes**: Object attributes (`self.x`).
  * **REST Endpoints**: HTTP route decorations (`@app.get`, `@app.post`, etc.).
  * **Modules**: File-level container with import statements.
* **Repository Orchestrator (`backend/parser/repo_orchestrator.py`)**: Pure orchestration coordinator depending strictly on abstract `VCSProvider` and `EntityExtractor` contracts to coordinate cloning, file traversal, and parallel AST extraction.
* **Facade & Entrypoint (`backend/parser/repo_parser.py`)**: Exposes public factory functions (`parse_git_repository()`, `parse_smartfix_repository()`) and backwards-compatible aliases.

### 3.2. Multi-Relational Dependency Knowledge Graph (`backend/graph/dependency_graph.py`)
Built using `NetworkX`. Nodes represent the extracted entities, and directed edges model structural and architectural relationships:
* `DEFINES`: Module $\rightarrow$ Class/Function/Variable, Class $\rightarrow$ Method/Attribute.
* `CALLS`: Function $\rightarrow$ Function (resolved via lexical and symbol scope matching).
* `USES_VARIABLE`: Function $\rightarrow$ Variable.
* `ATTRIBUTE_ACCESS`: Function $\rightarrow$ Attribute.
* `INHERITS_FROM`: Class $\rightarrow$ Base Class.
* `IMPORTS`: Module $\rightarrow$ Imported Module/Symbol.
* `HTTP_CALLS`: Cross-service REST invocation links between microservice ports (e.g., Orchestrator calling Safety Engine on port 8003).

### 3.3. Vector Knowledge Base (`backend/vector_db/knowledge_base.py`)
* Vectorizes entity signatures, docstrings, and code snippets into dense vector representations.
* Supports cosine similarity top-$K$ semantic retrieval, allowing developers to query code logic in natural language and discover semantically coupled entities.

### 3.4. Dual Change-Impact Architectures

#### Architecture 1: Static Dependency + RAG (Multi-Stage Pipeline)
* **Stage 1 (Graph Traversal)**: Traverses predecessor and successor nodes up to depth $K$.
* **Stage 2 (Vector Retrieval)**: Retrieves top-$N$ semantically similar code snippets using the change diff and target symbol context.
* **Stage 3 (Weighted Fusion)**: Fuses topological distance and vector similarity into a unified score:
  $$\text{Score}(e) = \alpha \cdot \text{GraphRelevance}(e) + (1-\alpha) \cdot \text{VectorSimilarity}(e)$$
* **Stage 4 (Sub-13B LLM Risk Summarizer)**: Categorizes impacts into severity levels (HIGH, MEDIUM, LOW).

#### Architecture 2: Hybrid Intelligent Impact Analysis (Agentic Multi-LLM)
* **Intent & Scope Classifier Agent**: Classifies the change (e.g., `API_SIGNATURE_MODIFICATION`, `INTERNAL_REFACTOR`, `STATE_MUTATION`).
* **Graph-Informed Multi-Hop Retriever**: Executes multi-hop walks across the dependency graph coupled with semantic code retrieval.
* **Specialized Domain Agents**:
  * *Call-Chain Agent*: Analyzes argument propagation and signature breaks.
  * *Dataflow Agent*: Traces variable mutations and state side-effects.
  * *REST Boundary Agent*: Traces cross-microservice HTTP contracts.
* **Consensus Re-ranker**: Synthesizes agent outputs, computes a consensus confidence score, and generates a traceable, step-by-step proof chain.

---

## 4. Sub-13B LLM Selection Taxonomy

To guarantee privacy, low latency, and cost-efficient execution on local hardware or CI/CD runners, all candidate models are strictly constrained to **$\le 13\text{B}$ parameters**:

```text
+----------------------------------------------------------------------------------------------------+
| Task Role                   | Primary Candidate            | Fallback Candidate         | Size     |
+-----------------------------+------------------------------+----------------------------+----------+
| AST Symbol & Parsing        | DeepSeek-Coder-1.3B-Instruct | Qwen2.5-Coder-1.5B-Instruct| 1.3B-1.5B|
| Graph-RAG Query Translator  | Qwen2.5-Coder-7B-Instruct    | CodeLlama-7B-Instruct      | 7B       |
| Semantic Code Embeddings    | Nomic-Embed-Code             | BGE-Code-v1.5              | 0.3B-3B  |
| Impact Causal Reasoner      | DeepSeek-Coder-6.7B-Instruct | Mistral-7B-Instruct-v0.3   | 6.7B-7B  |
| Consensus Re-ranker         | Phi-3-mini-4K-Instruct       | Llama-3.1-8B-Instruct      | 3.8B-8B  |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Controlled Testbed: SmartFix Repository (Pinned Version: v1.0.0)

Testing and empirical benchmark evaluations were conducted and strictly pinned against version **`v1.0.0`** of the **SmartFix Controlled Benchmark Testbed**:
* **Version Identification**: `v1.0.0` (Controlled Benchmark Release)
* **Target Architecture**: Modular microservices and intelligence engine encompassing repository orchestration, multi-relational AST extraction, vector knowledge bases, and architectural simulation pipelines.
* **Extraction Metrics (Testbed v1.0.0)**:
  * **Files Analyzed**: 29 Python files
  * **AST Entities Extracted**: 719 entities
  * **Graph Nodes**: 633 nodes
  * **Relational Edges**: 2,677 dependencies

---

## 6. Evaluation Framework & Ground-Truth Scenarios

### 6.1. Metrics Formulations
* **Prediction Quality**:
  $$\text{Precision} = \frac{|\text{Predicted} \cap \text{GroundTruth}|}{|\text{Predicted}|}, \quad \text{Recall} = \frac{|\text{Predicted} \cap \text{GroundTruth}|}{|\text{GroundTruth}|}$$
  $$\text{F1} = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
* **Ranking Quality**:
  * **Mean Reciprocal Rank (MRR)**: Measures how early the first true impact appears in the ranked candidate list.
  * **Mean Average Precision (MAP)**: Measures precision across all relevant ranks.
  * **NDCG@5**: Normalized Discounted Cumulative Gain at $K=5$, penalizing true impacts that appear lower in the list.
* **System Performance**:
  * Execution latency (ms), peak resident set memory (MB), and CPU utilization (%).

### 6.2. Controlled Ground-Truth Scenarios (Pinned to v1.0.0)
All evaluation scenarios are grounded in the active codebase and pinned to version **`v1.0.0`**, exercising key architectural interfaces and propagation paths:

1. **Scenario 1 (`SCENARIO_1` | Orchestrator Parse Pipeline Refactoring)**:
   * **Target Symbol**: `backend.parser.repo_orchestrator.RepositoryOrchestrator.parse`
   * **Diff**: `- def parse(self, path_or_url: Optional[str] = None):\n+ def parse(self, path_or_url: Optional[str] = None, enable_caching: bool = True):`
   * **Ground-Truth Impacts**: `backend.parser.repo_parser.parse_git_repository`, `backend.parser.repo_orchestrator.RepositoryOrchestrator`, `backend.parser.git_service.VCSProvider.get_metadata`, `backend.parser.ast_extractor.ASTEntityExtractor.extract`.
2. **Scenario 2 (`SCENARIO_2` | Vector Search Query Scoring Modification)**:
   * **Target Symbol**: `backend.vector_db.knowledge_base.VectorKnowledgeBase.search`
   * **Diff**: `- def search(self, query: str, top_k: int = 5):\n+ def search(self, query: str, top_k: int = 5, min_score: float = 0.05):`
   * **Ground-Truth Impacts**: `backend.main.search_vector_kb`, `backend.architectures.simulator.REIArchitectureSimulator.run_static_rag`, `backend.vector_db.knowledge_base.build_smartfix_vector_kb`, `backend.vector_db.knowledge_base.VectorKnowledgeBase`.
3. **Scenario 3 (`SCENARIO_3` | Dependency Graph Edge Builder Optimization)**:
   * **Target Symbol**: `backend.graph.dependency_graph.DependencyGraphBuilder.build_graph`
   * **Diff**: `- def build_graph(self) -> nx.DiGraph:\n+ def build_graph(self, include_transitive: bool = False) -> nx.DiGraph:`
   * **Ground-Truth Impacts**: `backend.graph.dependency_graph.build_smartfix_dependency_graph`, `backend.architectures.simulator.REIArchitectureSimulator.__init__`, `backend.graph.dependency_graph.DependencyGraphBuilder`.
4. **Scenario 4 (`SCENARIO_4` | AST Entity Extraction Method Signature Update)**:
   * **Target Symbol**: `backend.parser.ast_extractor.ASTEntityExtractor.extract`
   * **Diff**: `- def extract(self) -> List[Dict[str, Any]]:\n+ def extract(self, strict_mode: bool = False) -> List[Dict[str, Any]]:`
   * **Ground-Truth Impacts**: `backend.parser.repo_orchestrator.RepositoryOrchestrator.parse`, `backend.parser.ast_extractor.ASTEntityExtractor`, `backend.parser.ast_extractor.EntityExtractor.extract`.
5. **Scenario 5 (`SCENARIO_5` | Static RAG Architecture Execution Tuning)**:
   * **Target Symbol**: `backend.architectures.simulator.REIArchitectureSimulator.run_static_rag`
   * **Diff**: `- def run_static_rag(self, req: StaticRAGRequest):\n+ def run_static_rag(self, req: StaticRAGRequest, timeout_ms: int = 5000):`
   * **Ground-Truth Impacts**: `backend.architectures.simulator.REIArchitectureSimulator.run_hybrid_intelligent_analysis`, `backend.main.simulate_static_rag`, `backend.architectures.simulator.REIArchitectureSimulator`.

---

## 7. Web Application & Dashboard Architecture

* **Backend**: FastAPI running on Python 3.13 / Uvicorn (Port 8000).
* **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide Icons (Port 3000).
* **Views**:
  1. *Architectural Design & LLMs*: Interactive data flow cards and sub-13B LLM selection matrix table.
  2. *Dependency Graph Explorer*: Searchable entity list with live incoming and outgoing dependency inspectors.
  3. *Vector Knowledge Base*: Semantic search sandbox over SmartFix embeddings.
  4. *Impact Simulator*: Code diff input with side-by-side comparison of Static RAG vs. Hybrid Multi-Agent analysis.
  5. *Evaluation Dashboard*: Automated benchmark suite displaying Precision, Recall, F1, MRR, MAP, NDCG@5, and system overhead metrics.

---

## 8. Summary of Phase 1 Status & Phase 2 Roadmap

* **Phase 1 (Complete)**:
  * AST parser, multi-relational dependency graph, and vector database fully implemented and verified on SmartFix.
  * Formal data flows and Pydantic interfaces designed for both architectures.
  * Sub-13B LLM candidate matrix defined.
  * Evaluation scripts and 5 ground-truth benchmark scenarios configured.
  * React dashboard built and verified with zero compilation errors.
* **Phase 2 (In-Progress)**:
  * Deploying local model inference (Ollama / vLLM) for the candidate models.
  * Conducting empirical benchmark runs comparing Static RAG against Hybrid Intelligent Analysis.
  * Performing ablation studies analyzing the latency-vs-accuracy tradeoff of multi-agent re-ranking.
* **Phase 3 (Upcoming: Universal Polyglot Engine & Dynamic Service Discovery)**:
  * **Tree-sitter Integration**: Replacing language-specific AST walkers with unified Tree-sitter Concrete Syntax Tree (CST) parsers for high-throughput, incremental syntax processing.
  * **Multi-Language Support**: Developing entity extractors and call-graph builders for TypeScript/JavaScript, Java, C, and Rust.
  * **Dynamic Microservice Discovery**: Replacing hardcoded port/regex matching with dynamic service boundary detection via OpenAPI/Swagger specifications, Docker Compose/Kubernetes network manifests, and protobuf/gRPC contract definitions.
