import math
import threading
from typing import Iterable, List

from google import genai
from google.genai import types

from config import Config


_client = None
_client_lock = threading.Lock()


def get_gemini_client():
    """Create one pooled, retry-enabled Gemini client per Python process."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                if not Config.GEMINI_API_KEY:
                    raise RuntimeError("GEMINI_API_KEY is required")
                _client = genai.Client(
                    api_key=Config.GEMINI_API_KEY,
                    http_options=types.HttpOptions(
                        timeout=Config.GEMINI_TIMEOUT_MS,
                        retry_options=types.HttpRetryOptions(
                            attempts=Config.GEMINI_MAX_RETRIES,
                        ),
                    ),
                )
    return _client


def _normalized(values: Iterable[float]) -> List[float]:
    vector = [float(value) for value in values]
    norm = math.sqrt(sum(value * value for value in vector))
    if not math.isfinite(norm) or norm == 0:
        raise ValueError("Gemini returned an invalid embedding")
    return [value / norm for value in vector]


class GeminiEmbeddings:
    """LangChain-shaped embedding adapter with retrieval-specific task types."""

    def __init__(self, model: str = Config.EMBEDDING_MODEL):
        self.model = model
        self.client = get_gemini_client()

    def _embed(self, texts: List[str], task_type: str) -> List[List[float]]:
        if not texts:
            return []
        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Embedding inputs must contain non-empty text")
        response = self.client.models.embed_content(
            model=self.model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=Config.GEMINI_EMBEDDING_DIMENSIONS,
            ),
        )
        embeddings = response.embeddings or []
        if len(embeddings) != len(texts):
            raise RuntimeError("Gemini returned an unexpected embedding count")
        return [_normalized(embedding.values) for embedding in embeddings]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> List[float]:
        return self._embed([text], "RETRIEVAL_QUERY")[0]


class GeminiLLM:
    """Small synchronous adapter used by the grounding and memory layers."""

    def __init__(self, model: str = Config.LLM_MODEL):
        self.model = model
        self.client = get_gemini_client()
        self.generation_config = types.GenerateContentConfig(
            temperature=Config.GEMINI_TEMPERATURE,
            max_output_tokens=Config.GEMINI_MAX_OUTPUT_TOKENS,
        )

    def invoke(self, prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self.generation_config,
        )
        if not response.text:
            raise RuntimeError("Gemini returned no text")
        return response.text

    def stream(self, prompt: str):
        for chunk in self.client.models.generate_content_stream(
            model=self.model,
            contents=prompt,
            config=self.generation_config,
        ):
            if chunk.text:
                yield chunk.text
