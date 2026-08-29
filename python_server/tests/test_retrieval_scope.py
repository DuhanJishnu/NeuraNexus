import pathlib
import sys
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from utils.retrieval_scope import build_document_filter


class RetrievalScopeTests(unittest.TestCase):
    def test_missing_scope_allows_only_global_and_legacy_vectors(self):
        self.assertEqual(
            build_document_filter({}),
            "(HAS NOT FIELD visibility OR visibility = 'GLOBAL')",
        )

    def test_document_ids_are_rendered_as_bounded_filter(self):
        self.assertEqual(
            build_document_filter({"document_ids": ["doc_1", "doc2"]}),
            "(HAS NOT FIELD visibility OR visibility = 'GLOBAL') "
            "AND file_id IN ('doc_1', 'doc2')",
        )

    def test_principal_can_retrieve_global_and_owned_private_vectors(self):
        self.assertEqual(
            build_document_filter({
                "retrieval_scope": {
                    "principal_id": "user_123",
                    "include_global": True,
                }
            }),
            "(HAS NOT FIELD visibility OR visibility = 'GLOBAL' OR "
            "(visibility = 'PRIVATE' AND owner_id = 'user_123'))",
        )

    def test_untrusted_principal_syntax_is_rejected(self):
        with self.assertRaises(ValueError):
            build_document_filter({
                "retrieval_scope": {"principal_id": "x' OR 1=1"}
            })

    def test_filter_injection_is_rejected(self):
        with self.assertRaises(ValueError):
            build_document_filter({"document_ids": ["doc' OR 1=1"]})

    def test_excessive_filter_is_rejected(self):
        with self.assertRaises(ValueError):
            build_document_filter({"document_ids": [str(i) for i in range(101)]})
