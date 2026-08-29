from upstash_vector import Index
from typing import List, Dict, Any, Optional
import math

from config import Config
from .rank_fusion import reciprocal_rank_fusion
from .sparse_encoder import HashingSparseEncoder

try:
    from upstash_vector import Vector
    from upstash_vector.types import SparseVector, WeightingStrategy
except ImportError:  # Allows dense-only operation with older SDKs.
    Vector = None
    SparseVector = None
    WeightingStrategy = None

class VectorDB:
    def __init__(
        self,
        hybrid_enabled: Optional[bool] = None,
        index_version: Optional[str] = None,
    ):
        """Initialize the Upstash Vector DB client."""
        self.index_version = index_version or Config.INDEX_VERSION
        configured = Config.VECTOR_INDEXES.get(self.index_version)
        if configured is not None:
            if not isinstance(configured, dict):
                raise RuntimeError(f"Invalid vector configuration for {self.index_version}")
            url = configured.get("url")
            token = configured.get("token")
            if not url or not token:
                raise RuntimeError(
                    f"Vector index {self.index_version} requires url and token"
                )
            self.index = Index(url=url, token=token)
            configured_hybrid = bool(configured.get("hybrid", False))
        elif self.index_version == Config.INDEX_VERSION:
            self.index = Index.from_env()
            configured_hybrid = Config.HYBRID_SEARCH_ENABLED
        else:
            raise ValueError(f"Vector index version is not configured: {self.index_version}")
        self.hybrid_enabled = (
            configured_hybrid if hybrid_enabled is None else hybrid_enabled
        )
        self.sparse_encoder = HashingSparseEncoder(Config.SPARSE_HASH_DIMENSIONS)
        weights = (Config.HYBRID_DENSE_WEIGHT, Config.HYBRID_SPARSE_WEIGHT)
        if (
            any(not math.isfinite(weight) or weight < 0 for weight in weights)
            or sum(weights) == 0
        ):
            raise ValueError("Hybrid retrieval weights must be finite, nonnegative, and not both zero")
        if self.hybrid_enabled and (
            Vector is None or SparseVector is None or WeightingStrategy is None
        ):
            raise RuntimeError(
                "Hybrid retrieval requires an Upstash SDK with Vector and SparseVector support"
            )

    @classmethod
    def configured_versions(cls) -> List[str]:
        versions = set(Config.VECTOR_INDEXES)
        versions.add(Config.INDEX_VERSION)
        return sorted(versions)

    def add_documents(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """Add documents to the Upstash Vector DB in safe batches."""
        vectors_to_upsert = []
        for chunk in chunks:
            # Generate a unique ID for each vector
            vector_id = chunk["metadata"]["chunk_id"]
            
            # This index is queried with Gemini text embeddings, so only Gemini
            # text vectors may be inserted. CLIP image vectors require their own
            # index and CLIP text-query encoder.
            embedding = chunk.get("embedding_text")
            if not embedding:
                raise ValueError(f"Chunk {vector_id} has no text embedding")
            if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in embedding):
                raise ValueError(f"Chunk {vector_id} contains an invalid text embedding")
            
            # Attach metadata
            metadata = {
                "content": chunk["content"],
                **chunk["metadata"]
            }
            
            if self.hybrid_enabled:
                sparse = self.sparse_encoder.encode(chunk["content"])
                if not sparse.indices:
                    raise ValueError(f"Chunk {vector_id} has no lexical content")
                vectors_to_upsert.append(Vector(
                    id=vector_id,
                    vector=embedding,
                    sparse_vector=SparseVector(sparse.indices, sparse.values),
                    metadata=metadata,
                ))
            else:
                vectors_to_upsert.append((vector_id, embedding, metadata))

        # ✅ Handle Upstash batch size limit
        BATCH_LIMIT = 1000
        for i in range(0, len(vectors_to_upsert), BATCH_LIMIT):
            batch = vectors_to_upsert[i:i + BATCH_LIMIT]
            self.index.upsert(vectors=batch)
            print(f"✅ Uploaded batch {i//BATCH_LIMIT + 1} with {len(batch)} vectors")

        if self.hybrid_enabled:
            return [str(vector.id) for vector in vectors_to_upsert]
        return [vector_id for vector_id, _, _ in vectors_to_upsert]

    def search(
        self,
        query_embedding: List[float],
        query_text: str,
        k: int = 20,
        metadata_filter: Optional[str] = None,
    ) -> List[Dict]:
        """Use hybrid RRF when configured, otherwise preserve dense retrieval."""
        if not self.hybrid_enabled:
            return self.similarity_search(
                query_embedding, k=k, metadata_filter=metadata_filter
            )

        sparse = self.sparse_encoder.encode(query_text)
        common_args = {
            "top_k": k,
            "include_metadata": True,
            "include_vectors": False,
        }
        if metadata_filter:
            common_args["filter"] = metadata_filter

        dense_items = self.index.query(vector=query_embedding, **common_args)
        sparse_items = self.index.query(
            sparse_vector=SparseVector(sparse.indices, sparse.values),
            weighting_strategy=WeightingStrategy.IDF,
            **common_args,
        ) if sparse.indices else []

        fused = reciprocal_rank_fusion(
            [self._raw_candidates(dense_items), self._raw_candidates(sparse_items)],
            [Config.HYBRID_DENSE_WEIGHT, Config.HYBRID_SPARSE_WEIGHT],
            limit=k,
        )
        return [self._public_candidate(candidate) for candidate in fused]

    def delete_document(self, document_id: str) -> int:
        """Delete all deterministic vectors belonging to a document."""
        result = self.index.delete(prefix=f"{document_id}:")
        if result.deleted > 0:
            return result.deleted

        # Compatibility cleanup for vectors created before deterministic IDs.
        # This filter scan is only used when the efficient prefix deletion did
        # not find anything.
        legacy_result = self.index.delete(filter=f"file_id = '{document_id}'")
        return legacy_result.deleted

    def similarity_search(
        self,
        query_embedding: List[float],
        k: int = 5,
        threshold: float = 0.5,
        metadata_filter: Optional[str] = None,
    ) -> List[Dict]:
        """Search for similar documents in the Upstash Vector DB."""
        query_args = dict(
            vector=query_embedding,
            top_k=k,
            include_metadata=True,
            include_vectors=False,
        )
        if metadata_filter:
            query_args["filter"] = metadata_filter
        query_result = self.index.query(**query_args)
        
        results = []
        for item in query_result:
            if item.score >= threshold:
                results.append({
                    "id": item.id,
                    "content": item.metadata["content"],
                    "metadata": item.metadata,
                    "similarity_score": item.score,
                    "retrieval_method": "dense",
                })
        
        return results

    @staticmethod
    def _raw_candidates(items) -> List[Dict[str, Any]]:
        return [
            {
                "id": item.id,
                "score": float(item.score),
                "metadata": item.metadata or {},
            }
            for item in items
        ]

    @staticmethod
    def _public_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
        metadata = candidate.get("metadata", {})
        return {
            "id": candidate["id"],
            "content": metadata.get("content", ""),
            "metadata": metadata,
            "similarity_score": float(candidate.get("similarity_score", 0.0)),
            "lexical_score": float(candidate.get("lexical_score", 0.0)),
            "fusion_score": float(candidate["fusion_score"]),
            "dense_rank": candidate.get("dense_rank"),
            "sparse_rank": candidate.get("sparse_rank"),
            "retrieval_method": candidate["retrieval_method"],
        }

    def save(self):
        """Placeholder for saving the state if needed."""
        pass
