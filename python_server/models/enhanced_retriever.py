from typing import List, Dict, Any, Optional
import time
from .embedding_service import EmbeddingService
from .confidence_scorer import ConfidenceScorer
from .reranker import CrossEncoderReranker
from utils.retrieval_observability import log_retrieval

class EnhancedRetriever:
    def __init__(
        self,
        vector_db,
        embedding_service: EmbeddingService,
        reranker: Optional[CrossEncoderReranker] = None,
        top_k: int = 20,
        rerank_top_k: int = 5,
    ):
        self.vector_db = vector_db
        self.embedding_service = embedding_service
        self.confidence_scorer = ConfidenceScorer()
        self.reranker = reranker or CrossEncoderReranker()
        self.top_k = top_k
        self.rerank_top_k = rerank_top_k
    
    def retrieve_with_confidence(
        self, query: str, metadata_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retrieve documents with confidence scoring"""
        started = time.perf_counter()
        # Generate query embedding
        query_embedding = self.embedding_service.embedding_model.embed_query(query)
        normalized_query_embedding = self.embedding_service.normalize_embeddings([query_embedding])[0]
        
        # First-stage retrieval
        initial_results = self.vector_db.search(
            normalized_query_embedding,
            query,
            k=self.top_k,
            metadata_filter=metadata_filter,
        )

        if initial_results:
            reranked_results = self.reranker.rerank(query, initial_results)
            final_results = reranked_results[:self.rerank_top_k]
        else:
            reranked_results = []
            final_results = []

        confidence_metrics = self.confidence_scorer.calculate_retrieval_confidence(
            query, reranked_results
        )
        
        # Determine if we should proceed
        should_proceed, message = self.confidence_scorer.should_proceed_with_llm(
            confidence_metrics
        )
        confidence_metrics["should_proceed"] = should_proceed
        confidence_metrics["proceed_message"] = message
        latency_ms = (time.perf_counter() - started) * 1_000
        method = (
            initial_results[0].get("retrieval_method", "dense")
            if initial_results else ("hybrid_rrf" if self.vector_db.hybrid_enabled else "dense")
        )
        for result in final_results:
            result["retrieval_latency_ms"] = round(latency_ms, 2)
        confidence_metrics["retrieval_latency_ms"] = round(latency_ms, 2)
        confidence_metrics["retrieval_method"] = method
        log_retrieval(
            query, method, len(initial_results), len(final_results), latency_ms,
            metadata_filter is not None,
        )
        
        return {
            "documents": final_results,
            "confidence_metrics": confidence_metrics,
            "should_proceed": should_proceed,
            "proceed_message": message,
            "query_embedding": normalized_query_embedding  # For debugging
        }
