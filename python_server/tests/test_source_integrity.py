import ast
import pathlib
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]


class SourceIntegrityTests(unittest.TestCase):
    def test_all_python_sources_parse(self):
        for source_path in PYTHON_SERVER_ROOT.rglob("*.py"):
            with self.subTest(source=str(source_path)):
                ast.parse(source_path.read_text(encoding="utf-8"))

    def test_streaming_modules_avoid_invalid_multiline_fstrings(self):
        for relative_path in ("api/chat.py", "api_normal/chat_normal.py"):
            source = (PYTHON_SERVER_ROOT / relative_path).read_text(encoding="utf-8")
            self.assertNotIn('yield f"data: {json.dumps({', source)

    def test_active_ingestor_does_not_generate_random_fallback_vectors(self):
        source = (
            PYTHON_SERVER_ROOT / "models/document_ingestor_timestamp.py"
        ).read_text(encoding="utf-8")
        self.assertNotIn("np.random.normal", source)

    def test_python_runtime_no_longer_imports_ollama(self):
        runtime_roots = (
            PYTHON_SERVER_ROOT / "api",
            PYTHON_SERVER_ROOT / "api_memory_langchain",
            PYTHON_SERVER_ROOT / "api_normal",
            PYTHON_SERVER_ROOT / "models",
        )
        for source_path in (
            path for root in runtime_roots for path in root.rglob("*.py")
        ):
            with self.subTest(source=str(source_path)):
                source = source_path.read_text(encoding="utf-8")
                self.assertNotIn("langchain_ollama", source)

    def test_ingestion_status_is_fenced_by_attempt_lease(self):
        db_source = (
            PYTHON_SERVER_ROOT.parent / "node_server/src/lib/dbOperations.ts"
        ).read_text(encoding="utf-8")
        api_client_source = (
            PYTHON_SERVER_ROOT / "api_client/api_client.py"
        ).read_text(encoding="utf-8")
        self.assertIn('"processingLeaseId" = gen_random_uuid()::text', db_source)
        self.assertIn("processingLeaseId,\n      },", db_source)
        self.assertIn('"processingLeaseId": processing_lease_id', api_client_source)

    def test_reindex_completion_enforces_target_version(self):
        db_source = (
            PYTHON_SERVER_ROOT.parent / "node_server/src/lib/dbOperations.ts"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "vectorManifest.indexVersion !== claimedDocument.targetIndexVersion",
            db_source,
        )

    def test_ingestion_claims_bind_to_authoritative_active_index(self):
        source = (
            PYTHON_SERVER_ROOT.parent / "node_server/src/lib/dbOperations.ts"
        ).read_text(encoding="utf-8")
        self.assertIn('FROM "RagIndexDeployment"', source)
        self.assertIn('"targetIndexVersion" = COALESCE', source)

    def test_index_coverage_is_persisted_per_document_and_version(self):
        source = (
            PYTHON_SERVER_ROOT.parent / "node_server/src/lib/dbOperations.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("transaction.documentIndexManifest.upsert", source)
        self.assertIn("transaction.documentIndexManifest.deleteMany", source)

    def test_promotion_completeness_check_is_serializable(self):
        source = (
            PYTHON_SERVER_ROOT.parent
            / "node_server/src/services/indexDeployment.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("TransactionIsolationLevel.Serializable", source)
        self.assertIn("transaction.document.count", source)
        self.assertIn("transaction.documentIndexManifest.aggregate", source)

    def test_active_ingestion_carries_visibility_metadata(self):
        source = (
            PYTHON_SERVER_ROOT / "models/document_ingestor_timestamp.py"
        ).read_text(encoding="utf-8")
        self.assertGreaterEqual(source.count('"visibility": file_metadata.get'), 3)
        self.assertGreaterEqual(source.count('"owner_id": file_metadata.get'), 3)


if __name__ == "__main__":
    unittest.main()
