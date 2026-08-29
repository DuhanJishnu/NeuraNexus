from typing import List, Dict, Optional
import time
from .embedding_service import EmbeddingService
from .reranker import CrossEncoderReranker
from utils.retrieval_observability import log_retrieval

class Retriever:
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
        self.top_k = top_k
        self.rerank_top_k = rerank_top_k
        self.reranker = reranker or CrossEncoderReranker()
    
    def retrieve(self, query: str, metadata_filter: Optional[str] = None) -> List[Dict]:
        """Retrieve relevant documents for query"""
        started = time.perf_counter()
        # Generate query embedding
        query_embedding = self.embedding_service.embedding_model.embed_query(query)
        normalized_query_embedding = self.embedding_service.normalize_embeddings([query_embedding])[0]
        
        # First-stage retrieval: kNN search
        initial_results = self.vector_db.search(
            normalized_query_embedding,
            query,
            k=self.top_k,
            metadata_filter=metadata_filter,
        )
        
        # Second-stage semantic reranking with a cross encoder.
        reranked_results = self.reranker.rerank(query, initial_results)
        final_results = reranked_results[:self.rerank_top_k]
        latency_ms = (time.perf_counter() - started) * 1_000
        method = (
            initial_results[0].get("retrieval_method", "dense")
            if initial_results else ("hybrid_rrf" if self.vector_db.hybrid_enabled else "dense")
        )
        for result in final_results:
            result["retrieval_latency_ms"] = round(latency_ms, 2)
        log_retrieval(
            query, method, len(initial_results), len(final_results), latency_ms,
            metadata_filter is not None,
        )
        return final_results
