"""
Architectural Specifications, Data Flow Contracts, and Candidate LLM Selection Matrix.
Defines interfaces and Pydantic schemas for:
1. Static Dependency + RAG Architecture
2. Hybrid Intelligent Impact Analysis Architecture
All candidate LLMs are strictly <= 13B parameters.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ==========================================
# Specialized Sub-13B LLM Selection Matrix
# ==========================================

CANDIDATE_MODELS_MATRIX = {
    "ast_parsing": {
        "role": "AST Symbol & Entity Extractor",
        "primary_model": "DeepSeek-Coder-1.3B-Instruct",
        "fallback_model": "Qwen2.5-Coder-1.5B-Instruct",
        "param_count": "1.3B - 1.5B",
        "rationale": "Ultra-lightweight, extremely fast tokenization and structured syntax extraction.",
        "max_context": 16384,
    },
    "graph_translation": {
        "role": "Dependency & Graph-RAG Query Translator",
        "primary_model": "Qwen2.5-Coder-7B-Instruct",
        "fallback_model": "CodeLlama-7B-Instruct",
        "param_count": "7B",
        "rationale": "High code logic accuracy for translating natural/diff changes into multi-hop graph queries.",
        "max_context": 32768,
    },
    "semantic_embedding": {
        "role": "Semantic Code Retrieval & Dense Embedder",
        "primary_model": "Nomic-Embed-Code",
        "fallback_model": "BGE-Code-v1.5 / StarCoder2-3B",
        "param_count": "0.3B - 3B",
        "rationale": "Specialized code embedding model generating high-density vector representations.",
        "max_context": 8192,
    },
    "impact_reasoning": {
        "role": "Impact Propagation & Deep Causal Reasoner",
        "primary_model": "DeepSeek-Coder-6.7B-Instruct",
        "fallback_model": "Mistral-7B-Instruct-v0.3",
        "param_count": "6.7B - 7B",
        "rationale": "Superior causal reasoning across multi-hop function calls, state mutations, and microservice REST bounds.",
        "max_context": 32768,
    },
    "consensus_reranking": {
        "role": "Consensus Aggregator & Candidate Re-Ranker",
        "primary_model": "Phi-3-mini-4K-Instruct (3.8B)",
        "fallback_model": "Llama-3.1-8B-Instruct",
        "param_count": "3.8B - 8B",
        "rationale": "High-precision cross-attention candidate re-ranking, confidence calculation, and proof generation.",
        "max_context": 128000,
    }
}


# ==========================================
# Common Schemas
# ==========================================

class CodeChangeInput(BaseModel):
    target_symbol: str = Field(..., description="Target entity ID or function/variable name being modified.")
    file_path: str = Field(..., description="Path to the modified file in repository.")
    diff_snippet: str = Field(..., description="Code diff or modification text.")
    change_type: str = Field("MODIFICATION", description="MODIFICATION, SIGNATURE_CHANGE, DELETION, ADDITION")


class ImpactedEntity(BaseModel):
    entity_id: str
    name: str
    type: str
    file_path: str
    impact_score: float = Field(..., ge=0.0, le=1.0)
    severity: str = Field("MEDIUM", description="HIGH, MEDIUM, LOW")
    impact_type: str = Field(..., description="DIRECT_CALL, INDIRECT_DEPENDENCY, VARIABLE_MUTATION, REST_BOUND, TEST_COVERAGE")
    reasoning_chain: List[str] = Field(default_factory=list)


# ==========================================
# Architecture 1: Static Dependency + RAG
# ==========================================

class StaticRAGRequest(BaseModel):
    change_input: CodeChangeInput
    graph_traversal_depth: int = 2
    vector_top_k: int = 5
    fusion_alpha: float = 0.6  # Weight for graph vs vector


class StaticRAGResponse(BaseModel):
    architecture_name: str = "Static Dependency + RAG"
    target_symbol: str
    predicted_impacts: List[ImpactedEntity]
    static_graph_candidates_count: int
    vector_retrieved_chunks_count: int
    execution_latency_ms: float
    selected_llm: str = "DeepSeek-Coder-6.7B-Instruct (<= 13B)"
    pipeline_stages: List[Dict[str, Any]] = Field(default_factory=list)


# ==========================================
# Architecture 2: Hybrid Intelligent Impact Analysis
# ==========================================

class HybridAnalysisRequest(BaseModel):
    change_input: CodeChangeInput
    enable_multi_agent_reasoning: bool = True
    enable_graph_rag: bool = True
    confidence_threshold: float = 0.45


class AgentReasoningOutput(BaseModel):
    agent_name: str
    agent_role: str
    specialized_llm_used: str
    discovered_impacts: List[Dict[str, Any]]
    confidence_score: float
    reasoning_summary: str


class HybridAnalysisResponse(BaseModel):
    architecture_name: str = "Hybrid Intelligent Impact Analysis"
    target_symbol: str
    overall_risk_level: str  # CRITICAL, HIGH, MEDIUM, LOW
    ranked_impacts: List[ImpactedEntity]
    agent_outputs: List[AgentReasoningOutput]
    consensus_score: float
    proof_chain: List[str]
    execution_latency_ms: float
    models_orchestrated: List[str]
