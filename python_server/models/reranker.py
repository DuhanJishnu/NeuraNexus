from typing import Any, Dict, List, Optional

import numpy as np
from sentence_transformers import CrossEncoder


class CrossEncoderReranker:
    """Rerank dense candidates with a query-document cross encoder."""

    def __init__(self, model_name: str = 'cross-encoder/ms-marco-MiniLM-L-6-v2'):
        self.model: Optional[CrossEncoder] = None
        try:
            self.model = CrossEncoder(model_name)
        except Exception as error:
            print(f"Warning: cross-encoder unavailable, using lexical fallback: {error}")

    def rerank(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not results:
            return []

        if self.model is None:
            return self._lexical_fallback(query, results)

        pairs = [(query, result.get("content", "")[:2_000]) for result in results]
        raw_scores = np.asarray(self.model.predict(pairs), dtype=float)
        calibrated_scores = 1.0 / (1.0 + np.exp(-np.clip(raw_scores, -20, 20)))

        reranked = []
        for result, cross_score in zip(results, calibrated_scores):
            candidate = dict(result)
            candidate["cross_encoder_score"] = float(cross_score)
            candidate["relevance_score"] = (
                0.8 * float(cross_score)
                + 0.2 * float(candidate.get("similarity_score", 0.0))
            )
            reranked.append(candidate)

        return sorted(reranked, key=lambda item: item["relevance_score"], reverse=True)

    @staticmethod
    def _lexical_fallback(
        query: str, results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        query_terms = {term for term in query.lower().split() if len(term) > 2}
        reranked = []
        for result in results:
            candidate = dict(result)
            content = candidate.get("content", "").lower()
            overlap = (
                sum(term in content for term in query_terms) / len(query_terms)
                if query_terms else 0.0
            )
            # Preserve a meaningful confidence signal when the model cannot be
            # loaded instead of substituting an arbitrary constant downstream.
            candidate["cross_encoder_score"] = overlap
            candidate["relevance_score"] = (
                0.7 * float(candidate.get("similarity_score", 0.0))
                + 0.3 * overlap
            )
            reranked.append(candidate)
        return sorted(reranked, key=lambda item: item["relevance_score"], reverse=True)
