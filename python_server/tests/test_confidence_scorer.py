import pathlib
import sys
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from models.confidence_scorer import ConfidenceScorer


class ConfidenceScorerTests(unittest.TestCase):
    def test_sparse_exact_match_can_proceed_after_reranking(self):
        scorer = ConfidenceScorer()
        metrics = scorer.calculate_retrieval_confidence(
            "API-123 policy",
            [{
                "content": "API-123 policy " * 50,
                "similarity_score": 0.0,
                "cross_encoder_score": 0.95,
                "relevance_score": 0.76,
            }],
        )
        should_proceed, _ = scorer.should_proceed_with_llm(metrics)
        self.assertTrue(should_proceed)
        self.assertEqual(metrics["max_similarity"], 0.0)
        self.assertEqual(metrics["max_evidence"], 0.76)
