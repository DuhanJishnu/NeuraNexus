import threading
from collections import Counter


LATENCY_BUCKETS_MS = (50, 100, 250, 500, 1_000, 2_000, 5_000, 10_000)


class RetrievalMetrics:
    """Small Prometheus-compatible per-process retrieval metrics registry."""

    def __init__(self):
        self._lock = threading.Lock()
        self._requests = Counter()
        self._latency_buckets = Counter()
        self._latency_sum = Counter()

    def observe(self, method: str, latency_ms: float, success: bool = True) -> None:
        status = "success" if success else "error"
        key = (method, status)
        with self._lock:
            self._requests[key] += 1
            self._latency_sum[method] += latency_ms / 1_000
            for bucket in LATENCY_BUCKETS_MS:
                if latency_ms <= bucket:
                    self._latency_buckets[(method, bucket)] += 1
            self._latency_buckets[(method, float("inf"))] += 1

    def render(self) -> str:
        with self._lock:
            lines = [
                "# HELP rag_retrieval_requests_total Retrieval operations.",
                "# TYPE rag_retrieval_requests_total counter",
            ]
            for (method, status), value in sorted(self._requests.items()):
                lines.append(
                    f'rag_retrieval_requests_total{{method="{method}",status="{status}"}} {value}'
                )
            lines.extend([
                "# HELP rag_retrieval_latency_seconds Retrieval latency.",
                "# TYPE rag_retrieval_latency_seconds histogram",
            ])
            methods = sorted(self._latency_sum)
            for method in methods:
                for bucket in (*LATENCY_BUCKETS_MS, float("inf")):
                    label = "+Inf" if bucket == float("inf") else str(bucket / 1_000)
                    value = self._latency_buckets[(method, bucket)]
                    lines.append(
                        f'rag_retrieval_latency_seconds_bucket{{method="{method}",le="{label}"}} {value}'
                    )
                count = self._latency_buckets[(method, float("inf"))]
                lines.append(f'rag_retrieval_latency_seconds_count{{method="{method}"}} {count}')
                lines.append(
                    f'rag_retrieval_latency_seconds_sum{{method="{method}"}} '
                    f'{self._latency_sum[method]}'
                )
            return "\n".join(lines) + "\n"


retrieval_metrics = RetrievalMetrics()
