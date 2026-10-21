"""
Ollama Local LLM Gateway Module for REI.

Provides connection to the local Ollama daemon (http://localhost:11434).
Supports real sub-13B LLM inference (e.g., deepseek-coder:1.3b, codellama:7b)
with automatic fallback to heuristic simulation if Ollama is offline or unavailable.
"""

import json
import logging
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_FAST_MODEL = "deepseek-coder:1.3b"
FALLBACK_MODEL = "codellama:7b"


class OllamaClient:
    """
    Lightweight HTTP client for the local Ollama API.
    Does not require external third-party SDKs; uses standard Python urllib.
    """

    def __init__(self, base_url: str = OLLAMA_BASE_URL, default_model: str = DEFAULT_FAST_MODEL):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model

    def is_available(self) -> bool:
        """Checks whether the local Ollama daemon is reachable."""
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=2) as response:
                return response.status == 200
        except Exception:
            return False

    def list_installed_models(self) -> List[str]:
        """Returns names of all locally installed Ollama models."""
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=3) as response:
                data = json.loads(response.read().decode())
                return [m.get("name", "") for m in data.get("models", [])]
        except Exception as e:
            logger.warning(f"Failed to list Ollama models: {e}")
            return []

    def resolve_best_model(self, requested_model: Optional[str] = None) -> str:
        """Resolves the best available local model."""
        installed = self.list_installed_models()
        if not installed:
            return requested_model or self.default_model

        # 1. Exact match
        if requested_model and requested_model in installed:
            return requested_model

        # 2. Check for deepseek-coder:1.3b
        for m in installed:
            if "deepseek-coder:1.3b" in m:
                return m

        # 3. Check for codellama
        for m in installed:
            if "codellama" in m:
                return m

        # 4. Fallback to first available model
        return installed[0]

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 120,
        temperature: float = 0.2,
        timeout: int = 20,
    ) -> Optional[str]:
        """
        Executes a real LLM generation call via Ollama /api/generate.
        Returns the text response or None if the request failed.
        """
        target_model = self.resolve_best_model(model)
        payload: Dict[str, Any] = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/api/generate",
                data=data_bytes,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                res_data = json.loads(response.read().decode())
                return res_data.get("response", "").strip()
        except Exception as e:
            logger.warning(f"Ollama generation failed for {target_model}: {e}")
            return None


# Global singleton instance
ollama_client = OllamaClient()
