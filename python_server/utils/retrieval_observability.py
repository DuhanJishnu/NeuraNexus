import hashlib
import json
import logging
from utils.metrics import retrieval_metrics
from utils.request_context import request_id_var


logger = logging.getLogger("rag.retrieval")


def log_retrieval(
    query: str,
    method: str,
    candidate_count: int,
    result_count: int,
    latency_ms: float,
    scoped: bool,
) -> None:
    """Emit structured retrieval telemetry without logging user query text."""
    logger.info(json.dumps({
        "event": "retrieval_completed",
        "query_hash": hashlib.sha256(query.encode("utf-8")).hexdigest()[:16],
        "method": method,
        "candidate_count": candidate_count,
        "result_count": result_count,
        "latency_ms": round(latency_ms, 2),
        "scoped": scoped,
        "request_id": request_id_var.get(),
    }, separators=(",", ":")))
    retrieval_metrics.observe(method, latency_ms)
