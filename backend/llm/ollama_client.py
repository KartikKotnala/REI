"""
Ollama Local Inference Client for Repository Evolution Intelligence (REI).
Interfaces with local Ollama runtime (http://localhost:11434) to provide
real sub-13B LLM inference with graceful fallback to deterministic simulation.
"""

import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen2.5-coder:1.5b"


def check_ollama_status(base_url: str = OLLAMA_BASE_URL) -> Dict[str, Any]:
    """
    Checks if local Ollama daemon is reachable and retrieves available models.
    """
    try:
        req = urllib.request.Request(f"{base_url}/api/tags", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name") for m in data.get("models", [])]
                preferred_model = DEFAULT_MODEL if DEFAULT_MODEL in models else (models[0] if models else None)
                return {
                    "online": True,
                    "base_url": base_url,
                    "available_models": models,
                    "active_model": preferred_model,
                }
    except Exception as e:
        logger.debug(f"Ollama offline or unreachable: {e}")

    return {
        "online": False,
        "base_url": base_url,
        "available_models": [],
        "active_model": None,
    }


def generate_completion(
    prompt: str,
    system: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    base_url: str = OLLAMA_BASE_URL,
    timeout: float = 12.0,
    temperature: float = 0.2,
) -> Optional[str]:
    """
    Calls Ollama generate API synchronously with timeout. Returns None if unreachable.
    """
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 256,
        },
    }
    if system:
        payload["system"] = system

    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/api/generate",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                result = json.loads(resp.read().decode("utf-8"))
                return result.get("response", "").strip()
    except Exception as e:
        logger.warning(f"Ollama generation failed or timed out: {e}")
        return None


def run_ollama_risk_summarization(
    target_symbol: str,
    diff_snippet: str,
    impacted_candidate_names: List[str],
    model: str = DEFAULT_MODEL,
) -> Optional[Dict[str, Any]]:
    """
    Uses local Ollama coder model to summarize breaking change impact and assign severity.
    """
    system_prompt = (
        "You are an expert software change-impact analysis engine. "
        "Analyze the given target symbol modification diff and list of candidate impacted dependencies. "
        "Output a concise 2-sentence risk summary explaining the ripple effects, followed by a line: SEVERITY: HIGH, MEDIUM, or LOW."
    )
    prompt = (
        f"Target Modified Symbol: {target_symbol}\n"
        f"Code Diff Snippet:\n{diff_snippet}\n\n"
        f"Downstream/Upstream Impact Candidates:\n{', '.join(impacted_candidate_names[:6])}\n\n"
        "Assess breaking impact:"
    )

    response_text = generate_completion(prompt, system=system_prompt, model=model, timeout=12.0)
    if not response_text:
        return None

    # Parse severity if present
    severity = "HIGH"
    if "SEVERITY: LOW" in response_text.upper():
        severity = "LOW"
    elif "SEVERITY: MEDIUM" in response_text.upper():
        severity = "MEDIUM"
    elif "SEVERITY: HIGH" in response_text.upper() or "CRITICAL" in response_text.upper():
        severity = "HIGH"

    clean_summary = response_text.replace("SEVERITY: HIGH", "").replace("SEVERITY: MEDIUM", "").replace("SEVERITY: LOW", "").strip()
    return {
        "summary": clean_summary,
        "severity": severity,
        "model": model,
        "is_live_inference": True,
    }


def run_ollama_agent_reasoning(
    agent_name: str,
    agent_role: str,
    target_symbol: str,
    diff_snippet: str,
    candidate_entities: List[str],
    model: str = DEFAULT_MODEL,
) -> Optional[str]:
    """
    Executes reasoning for a specific domain agent (Call-Chain, Dataflow, REST Boundary) via Ollama.
    """
    system_prompt = (
        f"You are the {agent_name} in a Software Change-Impact Analysis engine. "
        f"Role: {agent_role}. "
        "Provide a concise, 1-2 sentence technical assessment of whether this code change triggers breaking ripple effects or state corruption."
    )
    prompt = (
        f"Modified Symbol: {target_symbol}\n"
        f"Diff:\n{diff_snippet}\n"
        f"Connected Entities: {', '.join(candidate_entities[:5])}\n"
        "Technical analysis:"
    )

    return generate_completion(prompt, system=system_prompt, model=model, timeout=10.0)
