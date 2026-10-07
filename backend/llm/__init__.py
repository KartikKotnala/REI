"""
LLM inference clients and providers for REI.
"""
from backend.llm.ollama_client import (
    check_ollama_status,
    generate_completion,
    run_ollama_risk_summarization,
    run_ollama_agent_reasoning,
    DEFAULT_MODEL,
)

__all__ = [
    "check_ollama_status",
    "generate_completion",
    "run_ollama_risk_summarization",
    "run_ollama_agent_reasoning",
    "DEFAULT_MODEL",
]
