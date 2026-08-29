import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from evaluation.metrics import evaluate_rankings
from evaluation.retrieval_eval import compare, run


class EvaluationMetricsTests(unittest.TestCase):
    def test_metrics_for_mixed_rankings(self):
        report = evaluate_rankings([
            {
                "relevant_document_ids": ["a"],
                "predicted_document_ids": ["x", "a"],
            },
            {
                "relevant_document_ids": ["b"],
                "predicted_document_ids": ["x", "y"],
            },
        ], k=2)
        self.assertEqual(report["hit_rate@2"], 0.5)
        self.assertEqual(report["mrr@2"], 0.25)
        self.assertEqual(report["recall@2"], 0.5)

    def test_unlabeled_cases_are_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_rankings([{"predicted_document_ids": []}])

    def test_live_evaluation_counts_errors_and_emits_promotion_metrics(self):
        cases = [
            {
                "question": "one",
                "relevant_document_ids": ["doc-1"],
            },
            {
                "question": "two",
                "relevant_document_ids": ["doc-2"],
            },
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl") as dataset:
            for case in cases:
                dataset.write(__import__("json").dumps(case) + "\n")
            dataset.flush()
            responses = [
                {"results": [{
                    "retrieval_method": "dense",
                    "metadata": {"file_id": "doc-1"},
                }]},
                OSError("failed"),
            ]
            with patch("evaluation.retrieval_eval._post_json", side_effect=responses) as post:
                report = run(pathlib.Path(dataset.name), "http://rag", "token", 5, "v2")

        self.assertEqual(report["error_rate"], 0.5)
        self.assertEqual(report["promotion_metrics"]["queryCount"], 2)
        self.assertEqual(post.call_args_list[0].args[2]["index_version"], "v2")

    def test_comparison_reports_candidate_minus_baseline(self):
        candidate = {
            "hit_rate@5": 0.8, "mrr@5": 0.7, "recall@5": 0.6,
            "ndcg@5": 0.75, "error_rate": 0.01, "latency_ms_p95": 120,
        }
        baseline = {
            "hit_rate@5": 0.7, "mrr@5": 0.6, "recall@5": 0.5,
            "ndcg@5": 0.65, "error_rate": 0.0, "latency_ms_p95": 100,
        }
        deltas = compare(candidate, baseline, 5)
        self.assertAlmostEqual(deltas["hit_rate@5"], 0.1)
        self.assertEqual(deltas["latency_ms_p95"], 20)
