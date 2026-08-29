import pathlib
import sys
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from models.rank_fusion import reciprocal_rank_fusion


class RankFusionTests(unittest.TestCase):
    def test_fusion_rewards_candidates_found_by_both_retrievers(self):
        dense = [{"id": "shared", "score": 0.8}, {"id": "dense", "score": 0.9}]
        sparse = [{"id": "shared", "score": 4.0}, {"id": "sparse", "score": 5.0}]
        results = reciprocal_rank_fusion([dense, sparse], [1.0, 1.0], limit=3)
        self.assertEqual(results[0]["id"], "shared")
        self.assertEqual(results[0]["dense_rank"], 1)
        self.assertEqual(results[0]["sparse_rank"], 1)

    def test_invalid_weight_count_is_rejected(self):
        with self.assertRaises(ValueError):
            reciprocal_rank_fusion([[]], [], limit=1)
