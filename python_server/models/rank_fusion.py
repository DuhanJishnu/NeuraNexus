from typing import Any, Dict, Iterable, List, Sequence


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Iterable[Dict[str, Any]]],
    weights: Sequence[float],
    limit: int,
    rrf_k: int = 60,
) -> List[Dict[str, Any]]:
    """Fuse independently ranked candidates by stable vector ID."""
    if len(ranked_lists) != len(weights):
        raise ValueError("Each ranked list requires exactly one weight")
    if limit < 1 or rrf_k < 1:
        raise ValueError("limit and rrf_k must be positive")

    candidates: Dict[str, Dict[str, Any]] = {}
    scores: Dict[str, float] = {}
    ranks: Dict[str, Dict[str, int]] = {}
    rank_names = ("dense_rank", "sparse_rank")

    for list_index, (ranked, weight) in enumerate(zip(ranked_lists, weights)):
        if weight < 0:
            raise ValueError("RRF weights cannot be negative")
        rank_name = rank_names[list_index] if list_index < len(rank_names) else f"rank_{list_index}"
        for rank, candidate in enumerate(ranked, start=1):
            vector_id = str(candidate["id"])
            candidates.setdefault(vector_id, dict(candidate))
            scores[vector_id] = scores.get(vector_id, 0.0) + weight / (rrf_k + rank)
            ranks.setdefault(vector_id, {})[rank_name] = rank
            if list_index == 0:
                candidates[vector_id]["similarity_score"] = candidate.get("score", 0.0)
            elif list_index == 1:
                candidates[vector_id]["lexical_score"] = candidate.get("score", 0.0)

    fused = []
    for vector_id, candidate in candidates.items():
        candidate.update(ranks[vector_id])
        candidate["fusion_score"] = scores[vector_id]
        candidate["retrieval_method"] = "hybrid_rrf"
        fused.append(candidate)
    return sorted(fused, key=lambda item: item["fusion_score"], reverse=True)[:limit]
