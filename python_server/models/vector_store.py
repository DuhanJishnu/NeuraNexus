from upstash_vector import Index
from typing import List, Dict, Any

class VectorDB:
    def __init__(self):
        """Initialize the Upstash Vector DB client."""
        self.index = Index.from_env()

    def add_documents(self, chunks: List[Dict[str, Any]]):
        """Add documents to the Upstash Vector DB in safe batches."""
        vectors_to_upsert = []
        for chunk in chunks:
            # Generate a unique ID for each vector
            vector_id = chunk["metadata"]["chunk_id"]
            
            # Choose embedding type (image or text)
            embedding = chunk.get("embedding_image", chunk.get("embedding_text"))
            
            # Attach metadata
            metadata = {
                "content": chunk["content"],
                **chunk["metadata"]
            }
            
            vectors_to_upsert.append((vector_id, embedding, metadata))

        # ✅ Handle Upstash batch size limit
        BATCH_LIMIT = 1000
        for i in range(0, len(vectors_to_upsert), BATCH_LIMIT):
            batch = vectors_to_upsert[i:i + BATCH_LIMIT]
            self.index.upsert(vectors=batch)
            print(f"✅ Uploaded batch {i//BATCH_LIMIT + 1} with {len(batch)} vectors")

    def similarity_search(self, query_embedding: List[float], k: int = 5, threshold: float = 0.7) -> List[Dict]:
        """Search for similar documents in the Upstash Vector DB."""
        query_result = self.index.query(
            vector=query_embedding,
            top_k=k,
            include_metadata=True,
            include_vectors=False
        )
        
        results = []
        for item in query_result:
            if item.score >= threshold:
                results.append({
                    "content": item.metadata["content"],
                    "metadata": item.metadata,
                    "similarity_score": item.score
                })
        
        return results

    def save(self):
        """Placeholder for saving the state if needed."""
        pass
