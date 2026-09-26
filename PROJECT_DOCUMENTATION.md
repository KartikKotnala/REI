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

### 3.1. Fine-Grained AST Parser (`backend/parser/repo_parser.py`)
Built using Python's native `ast` library. Rather than treating code merely as lines of text, the parser walks the abstract syntax tree and extracts distinct typed software entities:
* **Functions & Methods**: Name, signature, docstring, body snippet, line range, local/global variable references, internal function calls, and async flags.
* **Classes**: Class name, inheritance bases, docstrings, methods, and attributes.
* **Variables**: Module-level, class-level, and local scope variables.
* **Attributes**: Object attributes (`self.x`).
* **REST Endpoints**: HTTP route decorations (`@app.get`, `@app.post`, etc.).
* **Modules**: File-level container with import statements.

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

## 5. Controlled Testbed: SmartFix Repository

The system was evaluated against **SmartFix**, an AI-powered DevOps equipment troubleshooting platform built with Python microservices:
* **Microservices**: Orchestrator (8000), RAG Service (8001), Equipment (8002), Safety Engine (8003), History (8004), Spare Parts (8005), Tickets (8006), LLM Gateway (8007).
* **Extraction Metrics**:
  * **Files Analyzed**: 29 Python files
  * **AST Entities Extracted**: 719 entities
  * **Graph Nodes**: 633 nodes
  * **Relational Edges**: 2,677 edges

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

### 6.2. Controlled Ground-Truth Scenarios
1. **Scenario 1 (RAG Service Retrieve Signature Change)**: Modifying `RAGService.retrieve` to accept `enable_rerank: bool`. Ground-truth affected components: Orchestrator `ask_question`, Backend `query_rag`, RAG endpoint `retrieve_documents`.
2. **Scenario 2 (Safety Engine Rule Update)**: Modifying `SafetyEngine.evaluate` high-voltage rule from `WARNING` to `BLOCKED`. Ground-truth affected components: Orchestrator `ask_question`, Safety endpoint `evaluate_safety`.
3. **Scenario 3 (Equipment Schema Field Renaming)**: Renaming `serial_number` to `equipment_uuid` in `Equipment` data model. Ground-truth affected components: `get_equipment_details`, Spare parts `check_parts_availability`, History `get_maintenance_history`.
4. **Scenario 4 (LLM Gateway Generation Parameter Tuning)**: Modifying temperature and top-p in `generate_llm_response`. Ground-truth affected components: Orchestrator `ask_question`, LLM endpoint `generate_diagnosis`.
5. **Scenario 5 (Ticket Service Payload Mutation)**: Adding required priority level to `create_ticket`. Ground-truth affected components: `TicketRequest` schema, Orchestrator `create_field_ticket`.

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
