import pathlib
import sys
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from utils.metrics import RetrievalMetrics


class RetrievalMetricsTests(unittest.TestCase):
    def test_prometheus_histogram_uses_seconds_and_cumulative_buckets(self):
        metrics = RetrievalMetrics()
        metrics.observe("hybrid_rrf", 125)
        output = metrics.render()
        self.assertIn(
            'rag_retrieval_requests_total{method="hybrid_rrf",status="success"} 1',
            output,
        )
        self.assertIn(
            'rag_retrieval_latency_seconds_bucket{method="hybrid_rrf",le="0.25"} 1',
            output,
        )
        self.assertIn(
            'rag_retrieval_latency_seconds_sum{method="hybrid_rrf"} 0.125',
            output,
        )
