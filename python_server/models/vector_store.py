from upstash_vector import Index
from typing import List, Dict, Any

class VectorDB:
    def __init__(self):
        """Initialize the Upstash Vector DB client."""
        self.index = Index.from_env()

    def add_documents(self, chunks: List[Dict[str, Any]]):
        """Add documents to the Upstash Vector DB."""
        vectors_to_upsert = []
        for chunk in chunks:
            # The ID for the vector
            vector_id = chunk["metadata"]["chunk_id"]
            
            # The vector embedding
            embedding = chunk["embedding_image"] if "embedding_image" in chunk else chunk["embedding_text"]
            
            # The metadata to store with the vector
            metadata = {
                "content": chunk["content"],
                **chunk["metadata"]
            }
            
            vectors_to_upsert.append((vector_id, embedding, metadata))
        
        if vectors_to_upsert:
            self.index.upsert(vectors=vectors_to_upsert)

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