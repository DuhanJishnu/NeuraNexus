import math
from typing import Any, Dict, Iterable, List


def evaluate_rankings(cases: Iterable[Dict[str, Any]], k: int = 5) -> Dict[str, float]:
    """Calculate document-level retrieval metrics for labeled queries."""
    if k < 1:
        raise ValueError("k must be positive")

    rows = list(cases)
    if not rows:
        raise ValueError("At least one evaluation case is required")

    hit_total = reciprocal_rank_total = recall_total = precision_total = ndcg_total = 0.0
    for row in rows:
        relevant = set(row.get("relevant_document_ids") or [])
        if not relevant:
            raise ValueError("Every case requires relevant_document_ids")
        predicted = list(dict.fromkeys(row.get("predicted_document_ids") or []))[:k]
        relevance = [1 if document_id in relevant else 0 for document_id in predicted]

        hits = sum(relevance)
        hit_total += float(hits > 0)
        recall_total += hits / len(relevant)
        precision_total += hits / k

        first_hit = next((rank for rank, value in enumerate(relevance, 1) if value), None)
        reciprocal_rank_total += 1.0 / first_hit if first_hit else 0.0

        dcg = sum(value / math.log2(rank + 1) for rank, value in enumerate(relevance, 1))
        ideal_hits = min(len(relevant), k)
        ideal_dcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
        ndcg_total += dcg / ideal_dcg if ideal_dcg else 0.0

    count = len(rows)
    return {
        f"hit_rate@{k}": hit_total / count,
        f"mrr@{k}": reciprocal_rank_total / count,
        f"recall@{k}": recall_total / count,
        f"precision@{k}": precision_total / count,
        f"ndcg@{k}": ndcg_total / count,
        "query_count": float(count),
    }
