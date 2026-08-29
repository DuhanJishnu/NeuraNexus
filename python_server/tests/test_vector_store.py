import importlib
import pathlib
import sys
import types
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))


class _DeleteResult:
    def __init__(self, deleted):
        self.deleted = deleted


class _FakeIndex:
    def __init__(self):
        self.upserts = []
        self.deletes = []
        self.prefix_deleted = 0
        self.filter_deleted = 0
        self.queries = []

    def upsert(self, vectors):
        self.upserts.append(vectors)

    def delete(self, **kwargs):
        self.deletes.append(kwargs)
        if "prefix" in kwargs:
            return _DeleteResult(self.prefix_deleted)
        return _DeleteResult(self.filter_deleted)

    def query(self, **kwargs):
        self.queries.append(kwargs)
        return []


class _ConfiguredIndex(_FakeIndex):
    def __init__(self, url, token):
        super().__init__()
        self.url = url
        self.token = token


fake_upstash = types.ModuleType("upstash_vector")
fake_upstash.Index = object
sys.modules.setdefault("upstash_vector", fake_upstash)
fake_dotenv = types.ModuleType("dotenv")
fake_dotenv.load_dotenv = lambda: None
sys.modules.setdefault("dotenv", fake_dotenv)
VectorDB = importlib.import_module("models.vector_store").VectorDB
vector_store_module = sys.modules["models.vector_store"]


class _FakeSparseVector:
    def __init__(self, indices, values):
        self.indices = indices
        self.values = values


class _FakeWeightingStrategy:
    IDF = "IDF"


class _QueryItem:
    def __init__(self, vector_id, score, content):
        self.id = vector_id
        self.score = score
        self.metadata = {"content": content, "file_id": vector_id.split(":")[0]}


class VectorStoreTests(unittest.TestCase):
    def setUp(self):
        self.store = VectorDB.__new__(VectorDB)
        self.store.index = _FakeIndex()
        self.store.hybrid_enabled = False

    def test_upsert_returns_manifest_ids(self):
        vector_ids = self.store.add_documents([{
            "content": "evidence",
            "embedding_text": [0.1, 0.2],
            "metadata": {"chunk_id": "doc:chunk", "file_id": "doc"},
        }])
        self.assertEqual(vector_ids, ["doc:chunk"])
        self.assertEqual(len(self.store.index.upserts), 1)

    def test_versioned_index_uses_explicit_credentials(self):
        config = importlib.import_module("config").Config
        original_indexes = config.VECTOR_INDEXES
        original_index = vector_store_module.Index
        config.VECTOR_INDEXES = {
            "candidate-v2": {
                "url": "https://candidate.example",
                "token": "secret",
                "hybrid": False,
            },
        }
        vector_store_module.Index = _ConfiguredIndex
        try:
            store = VectorDB(index_version="candidate-v2")
        finally:
            config.VECTOR_INDEXES = original_indexes
            vector_store_module.Index = original_index
        self.assertEqual(store.index_version, "candidate-v2")
        self.assertEqual(store.index.url, "https://candidate.example")
        self.assertFalse(store.hybrid_enabled)

    def test_unknown_index_version_is_rejected(self):
        config = importlib.import_module("config").Config
        original_indexes = config.VECTOR_INDEXES
        config.VECTOR_INDEXES = {}
        try:
            with self.assertRaises(ValueError):
                VectorDB(index_version="missing-v9")
        finally:
            config.VECTOR_INDEXES = original_indexes

    def test_missing_text_embedding_is_rejected(self):
        with self.assertRaises(ValueError):
            self.store.add_documents([{
                "content": "image",
                "embedding_image": [0.1, 0.2],
                "metadata": {"chunk_id": "doc:image", "file_id": "doc"},
            }])

    def test_legacy_filter_is_used_only_when_prefix_finds_nothing(self):
        self.store.index.filter_deleted = 3
        self.assertEqual(self.store.delete_document("doc"), 3)
        self.assertEqual(
            self.store.index.deletes,
            [{"prefix": "doc:"}, {"filter": "file_id = 'doc'"}],
        )

    def test_empty_filter_is_not_sent_to_upstash(self):
        self.store.similarity_search([0.1, 0.2])
        self.assertNotIn("filter", self.store.index.queries[0])

    def test_scoped_search_sends_filter_to_upstash(self):
        self.store.similarity_search(
            [0.1, 0.2], metadata_filter="file_id IN ('doc')"
        )
        self.assertEqual(
            self.store.index.queries[0]["filter"], "file_id IN ('doc')"
        )

    def test_hybrid_search_fuses_dense_and_sparse_results(self):
        original_sparse_vector = vector_store_module.SparseVector
        original_weighting_strategy = vector_store_module.WeightingStrategy
        vector_store_module.SparseVector = _FakeSparseVector
        vector_store_module.WeightingStrategy = _FakeWeightingStrategy
        self.store.hybrid_enabled = True
        self.store.sparse_encoder = importlib.import_module(
            "models.sparse_encoder"
        ).HashingSparseEncoder(100_003)

        def query(**kwargs):
            self.store.index.queries.append(kwargs)
            if "vector" in kwargs:
                return [
                    _QueryItem("doc:shared", 0.8, "shared"),
                    _QueryItem("doc:dense", 0.7, "dense"),
                ]
            return [
                _QueryItem("doc:shared", 3.0, "shared"),
                _QueryItem("doc:sparse", 2.0, "sparse"),
            ]

        self.store.index.query = query
        try:
            results = self.store.search([0.1, 0.2], "API-123", k=3)
        finally:
            vector_store_module.SparseVector = original_sparse_vector
            vector_store_module.WeightingStrategy = original_weighting_strategy

        self.assertEqual(results[0]["id"], "doc:shared")
        self.assertEqual(results[0]["retrieval_method"], "hybrid_rrf")
        self.assertEqual(len(self.store.index.queries), 2)
        self.assertEqual(self.store.index.queries[1]["weighting_strategy"], "IDF")
