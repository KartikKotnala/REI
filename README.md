# REI: Repository Evolution Intelligence
### LLM-RAG Software Change-Impact Analysis Engine

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![NetworkX](https://img.shields.io/badge/Graph-NetworkX-orange.svg)](https://networkx.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Predicting and ranking transitive software breakages, state mutations, and microservice boundary impacts using graph structures and specialized Sub-13B LLMs.

---

## 1. Problem Statement

Modern software repositories and microservice ecosystems evolve rapidly. Even seemingly trivial modifications—such as altering a function signature, changing a default argument, modifying a shared configuration dictionary, or renaming a database field—can trigger cascading failures across distributed components.

Engineers and DevOps teams today face two distinct and flawed extremes when attempting to analyze change impact:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                The Change-Impact Dilemma                                │
├─────────────────────────────────────────┬──────────────────────────────────────────────┤
│    Traditional Linters & Static Analysis│         Large Monolithic LLMs (e.g. GPT-4)   │
├─────────────────────────────────────────┼──────────────────────────────────────────────┤
│ ❌ Blind to runtime & dynamic bindings  │ ❌ Hallucinations & non-deterministic output │
│ ❌ Fails at microservice REST boundaries│ ❌ Context window exhaustion on large repos  │
│ ❌ Misses semantic and dataflow nuances │ ❌ Extreme latency, high API cost, & privacy │
│ ❌ High false-negative rate             │ ❌ No verifiable, structured proof chain     │
└─────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### Limitations of Traditional Linters & Compilers
1. **Inability to Trace Dynamic & Loose Coupling:** Compilers and static linters (e.g., `flake8`, `mypy`, `eslint`) rely entirely on explicit symbol resolution. They cannot anticipate dynamic dispatch, reflection, implicit state mutations, or inter-service HTTP REST / gRPC API contracts.
2. **Context Blindness:** A linter checks syntactic correctness in isolation, but cannot reason about the *semantic intent* of a change or detect whether a business rule or invariant has been violated downstream.
3. **High False Negatives:** When a microservice endpoint changes an accepted payload structure, a static analyzer in an upstream repository reports zero warnings—yet the production workflow crashes at runtime.

### Limitations of Large Monolithic LLMs ($\ge 70\text{B}$ Parameters)
1. **Context Window Blowup & Token Costs:** Feeding an entire multi-service repository of tens or hundreds of thousands of lines of code into a single prompt blows through token limits, costs excessive amounts per inference, and produces prohibitive latency.
2. **Hallucination & Lack of Structural Grounding:** Unconstrained LLMs struggle to compute precise multi-hop call graphs from raw text; they often invent non-existent callers or hallucinate that unrelated files are broken.
3. **Enterprise Privacy & Local Deployment Barriers:** Sending proprietary enterprise code to third-party hosted APIs introduces compliance and security risks.

### The REI Solution
**REI bridges this gap** by fusing **symbolic graph structures** (deterministic AST call graphs and dependency networks) with **retrieval-augmented generation (RAG)** and **task-specialized sub-13B code models**. This ensures high precision, low latency, full reproducibility, and private on-premise execution.

---

## 2. System Architecture

```text
                               +-------------------------------------------------+
                               |           Proposed Code Change Input            |
                               |          (Target Symbol + Diff Snippet)         |
                               +------------------------+------------------------+
                                                        |
                         +------------------------------+------------------------------+
                         |                                                             |
                         v                                                             v
        +----------------------------------+                         +----------------------------------+
        |          Architecture 1:         |                         |          Architecture 2:         |
        |      Static Dependency + RAG     |                         | Hybrid Intelligent Impact Engine |
        +----------------+-----------------+                         +----------------+-----------------+
                         |                                                             |
         [Stage 1: AST Graph Traversal]                                  [Agent 1: Intent & Scope Classifier]
                         |                                                             |
         [Stage 2: Dense Vector Retrieval]                               [Multi-Hop Graph RAG Traversal]
                         |                                                             |
         [Stage 3: Score & Heuristic Fusion]                             [Specialized Reasoning Agents]
                         |                                               - Call-Chain Agent (1.3B)
         [Stage 4: Sub-13B Risk Summarizer]                              - Dataflow / State Agent (6.7B)
                         |                                               - REST Boundary Agent (7B)
                         |                                                             |
                         |                                               [Consensus Re-ranker (3.8B/8B)]
                         v                                                             v
        +----------------------------------+                         +----------------------------------+
        | Deterministic Candidate Impact   |                         | Ranked Impacted Components +     |
        | List (Fused Severity Score)      |                         | Traceable Proof Chain            |
        +----------------------------------+                         +----------------------------------+
```

---

## 3. Mathematical Modeling of the Built System

The current system implements formal graph modeling, vector retrieval fusion, multi-agent consensus, and standard Information Retrieval (IR) evaluation metrics.

### 3.1 Multi-Relational Dependency Graph

The target repository is formally represented as a directed, multi-relational attributed graph:

$$\mathcal{G} = (\mathcal{V}, \mathcal{E}, \mathcal{R})$$

Where:
* $\mathcal{V}$ is the set of extracted code entities:
  $$\mathcal{V} = \mathcal{V}_{\text{func}} \cup \mathcal{V}_{\text{class}} \cup \mathcal{V}_{\text{var}} \cup \mathcal{V}_{\text{attr}} \cup \mathcal{V}_{\text{endpoint}} \cup \mathcal{V}_{\text{module}}$$
* $\mathcal{R}$ is the relation taxonomy:
  $$\mathcal{R} = \{\text{DEFINES}, \text{INHERITS\_FROM}, \text{CALLS}, \text{USES\_VARIABLE}, \text{ATTRIBUTE\_ACCESS}, \text{HTTP\_CALLS}\}$$
* $\mathcal{E} \subseteq \mathcal{V} \times \mathcal{R} \times \mathcal{V}$ is the set of directed labeled edges connecting dependencies.

### 3.2 Architecture 1: Static Dependency + RAG Fusion

Given a target symbol $t \in \mathcal{V}$ and a code modification diff query $q$:

1. **Graph Proximity Score:**
   $$S_{\text{graph}}(e, t) = \begin{cases} 
   0.9, & \text{if } e \in \text{Pred}_{\mathcal{G}}(t) \quad (\text{Direct Callers / Dependents}) \\
   0.7, & \text{if } e \in \text{Succ}_{\mathcal{G}}(t) \quad (\text{Callees / Dependencies}) \\
   0.0, & \text{otherwise}
   \end{cases}$$

2. **Semantic Vector Similarity Score:**
   Using TF-IDF document embedding vectors $\mathbf{v}_q, \mathbf{v}_e \in \mathbb{R}^d$:
   $$S_{\text{vector}}(e, q) = \cos(\mathbf{v}_q, \mathbf{v}_e) = \frac{\mathbf{v}_q \cdot \mathbf{v}_e}{\|\mathbf{v}_q\|_2 \|\mathbf{v}_e\|_2}$$

3. **Weighted Score Fusion:**
   With parameter $\alpha \in [0, 1]$ (default $\alpha = 0.6$):
   $$S_{\text{fusion}}(e) = \alpha \cdot S_{\text{graph}}(e, t) + (1 - \alpha) \cdot S_{\text{vector}}(e, q)$$

Candidates are then ranked in descending order:
$$\pi_{\text{static}} = \text{argsort}_{e \in \mathcal{V}} \big( -S_{\text{fusion}}(e) \big)$$

### 3.3 Architecture 2: Multi-Agent Consensus Formulation

In the agentic architecture, specialized reasoning agents ($A = \{a_{\text{call}}, a_{\text{dataflow}}, a_{\text{rest}}\}$) each analyze the change independently using sub-13B LLMs and yield predictions $P_a \subseteq \mathcal{V}$ with confidence score $c_a \in [0, 1]$:

The aggregated consensus agreement score $\mathcal{C}$ across $M = |A|$ agents is modeled as:
$$\mathcal{C} = \frac{1}{M} \sum_{a \in A} c_a \cdot \frac{|P_a \cap P_{\text{candidates}}|}{|P_a \cup P_{\text{candidates}}|}$$

### 3.4 Evaluation & Benchmarking Metrics

For a set of test scenarios $Q$, predicted impact set $P_q$, and ground truth impacted entities $G_q$:

1. **Precision, Recall, and $F_1$-Score:**
   $$\text{Precision} = \frac{|P_q \cap G_q|}{|P_q|}, \quad \text{Recall} = \frac{|P_q \cap G_q|}{|G_q|}, \quad F_1 = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

2. **Mean Reciprocal Rank (MRR):**
   $$\text{MRR} = \frac{1}{|Q|} \sum_{q=1}^{|Q|} \frac{1}{\min_{e \in G_q} \text{rank}(e, P_q)}$$

3. **Mean Average Precision (MAP):**
   $$\text{MAP} = \frac{1}{|Q|} \sum_{q=1}^{|Q|} \left( \frac{1}{|G_q|} \sum_{k=1}^{|P_q|} \text{P@}k \cdot \mathbb{I}(e_k \in G_q) \right)$$

4. **Normalized Discounted Cumulative Gain ($\text{NDCG}@K$):**
   $$\text{DCG}@K = \sum_{r=1}^{K} \frac{2^{\text{rel}_r} - 1}{\log_2(r + 1)}, \quad \text{NDCG}@K = \frac{\text{DCG}@K}{\text{IDCG}@K}$$

---

## 4. Specialized Sub-13B LLM Selection Matrix

All reasoning tasks are explicitly allocated to specialized models $\le 13\text{B}$ parameters to allow local execution:

| Sub-Task Role | Primary Model ($\le 13\text{B}$) | Fallback Model | Params | Rationale |
|---|---|---|---|---|
| **AST Symbol & Entity Extraction** | `DeepSeek-Coder-1.3B-Instruct` | `Qwen2.5-Coder-1.5B` | 1.3B – 1.5B | High-throughput tokenization & structural syntax parsing |
| **Dependency & Graph Translation** | `Qwen2.5-Coder-7B-Instruct` | `CodeLlama-7B-Instruct` | 7B | Maps diffs and natural language into multi-hop graph queries |
| **Semantic Code Retrieval** | `Nomic-Embed-Code` | `BGE-Code-v1.5` / `StarCoder2-3B` | 0.3B – 3B | High-density semantic vector code embeddings |
| **Impact Reasoning & Propagation** | `DeepSeek-Coder-6.7B-Instruct` | `Mistral-7B-Instruct-v0.3` | 6.7B – 7B | Causal tracing across multi-hop calls and state mutations |
| **Consensus Aggregator & Re-Ranker**| `Phi-3-mini-4K-Instruct` | `Llama-3.1-8B-Instruct` | 3.8B – 8B | Cross-attention candidate re-ranking & proof generation |

---

## 5. Controlled Testbed: SmartFix Repository

The system is evaluated against **SmartFix**, an AI-powered DevOps equipment troubleshooting platform built with Python microservices:
* **Microservices**: Orchestrator (Port 8000), RAG Service (Port 8001), Equipment (Port 8002), Safety Engine (Port 8003), History (Port 8004), Spare Parts (Port 8005), Tickets (Port 8006), LLM Gateway (Port 8007).
* **Extraction Statistics**:
  * **Files Analyzed**: 29 Python files
  * **Total AST Entities Extracted**: 719 entities
  * **Graph Nodes**: 633 nodes
  * **Relational Edges**: 2,677 dependencies

---

## 6. Project Structure

```text
REI/
├── backend/
│   ├── main.py                     # FastAPI REST server & API routes
│   ├── architectures/
│   │   ├── contracts.py            # Pydantic schemas & Sub-13B LLM model matrix
│   │   └── simulator.py            # Simulation engine for Static RAG & Hybrid Multi-Agent
│   ├── parser/
│   │   └── repo_parser.py          # Python AST entity & relationship extractor
│   ├── graph/
│   │   └── dependency_graph.py     # NetworkX multi-relational graph builder
│   ├── vector_db/
│   │   └── knowledge_base.py       # TF-IDF & vector cosine semantic search
│   └── evaluation/
│       ├── benchmark_dataset.py    # 5 controlled synthetic benchmark scenarios
│       └── eval_metrics.py         # Precision, Recall, F1, MRR, MAP, NDCG@K formulas
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Top-level shell & navigation tabs
│   │   └── components/
│   │       ├── ArchitecturesView.jsx       # Architecture comparison & model matrix
│   │       ├── DependencyGraphView.jsx     # Visual graph explorer & entity inspector
│   │       ├── VectorKBView.jsx            # Semantic vector search workbench
│   │       ├── ImpactSimulatorView.jsx     # Live diff impact simulator
│   │       └── EvaluationDashboardView.jsx # Live benchmark comparison dashboard
│   ├── package.json                # React 18, Vite, Tailwind CSS, Lucide icons
│   └── vite.config.js              # Vite server & proxy configuration (/api -> :8000)
├── PROJECT_DOCUMENTATION.md        # Complete academic & technical specification
└── README.md
```

---

## 7. Installation and Setup

### Prerequisites
* **Python**: Version `3.10` or higher
* **Node.js**: Version `18.x` or higher (with `npm`)

---

### Step 1: Install Backend Dependencies

1. Navigate to the project root:
   ```bash
   cd REI
   ```
2. (Optional but recommended) Create and activate a virtual environment:
   * **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
3. Install required Python packages:
   ```bash
   pip install fastapi uvicorn networkx numpy pydantic scikit-learn
   ```

---

### Step 2: Install Frontend Dependencies

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```

---

## 8. Running the Application

To run the complete system, start the backend API server and the frontend client in separate terminal windows:

### Terminal 1: Launch Backend (FastAPI)

From the project root:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
* The API server will start at: **`http://localhost:8000`**
* Interactive Swagger API documentation: **`http://localhost:8000/docs`**

### Terminal 2: Launch Frontend (Vite + React)

From the `frontend` directory:
```bash
cd frontend
npm run dev
```
* The Vite dev server will launch at: **`http://localhost:3000`**

---

## 9. Interactive Dashboard Views

Once the frontend is running, navigate to `http://localhost:3000` to interact with the 5 modules:

1. **Architectural Design & LLMs (`/architectures`):**
   * Side-by-side comparison of the Multi-Stage Pipeline vs. the Agentic Orchestration approach.
   * Specification table for all sub-13B candidate models.
2. **Dependency Graph (`/graph`):**
   * Search and filter through classes, functions, variables, attributes, and REST endpoints.
   * Inspect incoming and outgoing dependencies (`CALLS`, `DEFINES`, `HTTP_CALLS`).
3. **Vector Knowledge Base (`/vector_kb`):**
   * Query the semantic vector space over repository code chunks with tunable top-$k$ matches.
4. **Impact Simulator (`/simulator`):**
   * Input a synthetic code diff or select an existing component.
   * Run the simulator to view predicted impacts, risk levels, and traceable proof chains.
5. **Evaluation Dashboard (`/evaluation`):**
   * Re-run the benchmark suite across the 5 controlled scenarios to view live Precision, Recall, F1, MRR, MAP, and NDCG@5 metrics.

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
