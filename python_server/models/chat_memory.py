import logging
import threading
from typing import Dict, List

from config import Config
from .gemini_client import GeminiLLM


logger = logging.getLogger(__name__)
conversation_histories: Dict[str, List[Dict[str, str]]] = {}
conversation_lock = threading.RLock()


class ChatMemory:
    """Compatibility memory layer backed by Gemini instead of Ollama/LangChain."""

    def __init__(self, model_name: str = Config.LLM_MODEL):
        self.llm = GeminiLLM(model=model_name)

    @staticmethod
    def _render(history: List[Dict[str, str]]) -> str:
        return "\n".join(
            f"{'Human' if item['role'] == 'user' else 'AI'}: {item['content']}"
            for item in history
        )

    def chat(self, conv_id: str, message: str) -> str:
        if not conv_id:
            raise ValueError("conv_id cannot be empty")
        if not message or not message.strip():
            return "Please provide a non-empty message."
        with conversation_lock:
            history = list(conversation_histories.get(conv_id, []))
        prompt = (
            "Continue this conversation helpfully and concisely.\n\n"
            f"Conversation:\n{self._render(history)}\nHuman: {message}\nAI:"
        )
        response = self.llm.invoke(prompt)
        with conversation_lock:
            conversation_histories.setdefault(conv_id, []).extend([
                {"role": "user", "content": message},
                {"role": "assistant", "content": response},
            ])
        return response

    def get_conversation_history(self, conv_id: str) -> str:
        with conversation_lock:
            return self._render(conversation_histories.get(conv_id, [])) \
                or "No conversation history found."

    def summarize_conversation(self, conv_id: str) -> str:
        history = self.get_conversation_history(conv_id)
        if history == "No conversation history found.":
            return "Conversation not found."
        return self.llm.invoke(
            "Provide a concise factual summary of this conversation:\n\n" + history
        )

    def load_summary(self, conv_id: str, summary: str):
        if not conv_id or not summary:
            raise ValueError("conv_id and summary are required")
        with conversation_lock:
            conversation_histories[conv_id] = [{
                "role": "assistant",
                "content": f"Previous conversation summary: {summary}",
            }]

    def clear_memory(self, conv_id: str):
        with conversation_lock:
            conversation_histories.pop(conv_id, None)

    def list_active_conversations(self) -> list:
        with conversation_lock:
            return list(conversation_histories)
