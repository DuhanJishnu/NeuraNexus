import importlib
import pathlib
import sys
import types
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))


class _ConfigObject:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


fake_google = types.ModuleType("google")
fake_genai = types.ModuleType("google.genai")
fake_types = types.ModuleType("google.genai.types")
fake_types.HttpOptions = _ConfigObject
fake_types.HttpRetryOptions = _ConfigObject
fake_types.EmbedContentConfig = _ConfigObject
fake_types.GenerateContentConfig = _ConfigObject
fake_genai.types = fake_types
fake_genai.Client = lambda **kwargs: None
fake_google.genai = fake_genai
sys.modules.setdefault("google", fake_google)
sys.modules.setdefault("google.genai", fake_genai)
sys.modules.setdefault("google.genai.types", fake_types)

gemini_module = importlib.import_module("models.gemini_client")


class _Models:
    def __init__(self):
        self.embed_calls = []

    def embed_content(self, **kwargs):
        self.embed_calls.append(kwargs)
        return types.SimpleNamespace(embeddings=[
            types.SimpleNamespace(values=[3.0, 4.0])
            for _ in kwargs["contents"]
        ])

    def generate_content(self, **kwargs):
        return types.SimpleNamespace(text="grounded answer")

    def generate_content_stream(self, **kwargs):
        return iter([
            types.SimpleNamespace(text="grounded "),
            types.SimpleNamespace(text="answer"),
        ])


class GeminiClientTests(unittest.TestCase):
    def setUp(self):
        self.models = _Models()
        gemini_module._client = types.SimpleNamespace(models=self.models)

    def test_embeddings_use_distinct_retrieval_tasks_and_normalize(self):
        embeddings = gemini_module.GeminiEmbeddings()
        document = embeddings.embed_documents(["document"])[0]
        query = embeddings.embed_query("query")
        self.assertEqual(document, [0.6, 0.8])
        self.assertEqual(query, [0.6, 0.8])
        self.assertEqual(
            self.models.embed_calls[0]["config"].task_type,
            "RETRIEVAL_DOCUMENT",
        )
        self.assertEqual(
            self.models.embed_calls[1]["config"].task_type,
            "RETRIEVAL_QUERY",
        )

    def test_llm_supports_complete_and_streamed_generation(self):
        llm = gemini_module.GeminiLLM()
        self.assertEqual(llm.invoke("prompt"), "grounded answer")
        self.assertEqual("".join(llm.stream("prompt")), "grounded answer")


if __name__ == "__main__":
    unittest.main()
