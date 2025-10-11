import numpy as np
from langchain_ollama import OllamaEmbeddings
from typing import List, Dict, Any, Tuple
import asyncio
from rank_bm25 import BM25Okapi
import re

class HybridEmbeddingService:
    def __init__(self, model_name: str = "nomic-embed-text:v1.5", batch_size: int = 32):
        self.embedding_model = OllamaEmbeddings(model=model_name)
        self.batch_size = batch_size
        self.embedding_dim = 768  # Default for nomic-embed-text
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings in batches to avoid memory issues"""
        embeddings = []
        
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            batch_embeddings = self.embedding_model.embed_documents(batch)
            embeddings.extend(batch_embeddings)
        
        return embeddings
    
    def normalize_embeddings(self, embeddings: List[List[float]]) -> List[List[float]]:
        """Normalize embeddings to unit length for better similarity search"""
        normalized = []
        for emb in embeddings:
            norm = np.linalg.norm(emb)
            if norm > 0:
                normalized.append((np.array(emb) / norm).tolist())
            else:
                normalized.append(emb)
        return normalized
    
    def tokenize_text(self, text: str) -> List[str]:
        """Tokenize text for BM25 (simple whitespace + lowercase)"""
        return re.findall(r'\b\w+\b', text.lower())
    
    def build_bm25_index(self, chunks: List[Dict]) -> BM25Okapi:
        """Build BM25 index from chunk contents"""
        tokenized_corpus = [self.tokenize_text(chunk["content"]) for chunk in chunks]
        return BM25Okapi(tokenized_corpus)
    
    def reciprocal_rank_fusion(self, dense_scores: List[float], sparse_scores: List[float], k: int = 60) -> List[float]:
        """
        Reciprocal Rank Fusion (RRF) for combining dense and sparse retrieval scores
        RRF(d) = Σ 1/(k + rank_i(d))
        """
        # Get ranks for each method
        dense_ranks = self._get_ranks(dense_scores)
        sparse_ranks = self._get_ranks(sparse_scores)
        
        # Calculate RRF scores
        rrf_scores = []
        for i in range(len(dense_scores)):
            rrf_score = (1 / (k + dense_ranks[i])) + (1 / (k + sparse_ranks[i]))
            rrf_scores.append(rrf_score)
        
        return rrf_scores
    
    def _get_ranks(self, scores: List[float]) -> List[int]:
        """Convert scores to ranks (higher score = better rank)"""
        sorted_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        ranks = [0] * len(scores)
        for rank, idx in enumerate(sorted_indices, 1):
            ranks[idx] = rank
        return ranks
    
    def weighted_combination(self, dense_scores: List[float], sparse_scores: List[float], alpha: float = 0.4) -> List[float]:
        """
        Weighted combination of normalized dense and sparse scores
        score = α * norm_sparse + (1-α) * norm_dense
        """
        # Normalize scores to 0-1 range
        norm_dense = self._min_max_normalize(dense_scores)
        norm_sparse = self._min_max_normalize(sparse_scores)
        
        # Weighted combination
        combined_scores = []
        for dense, sparse in zip(norm_dense, norm_sparse):
            combined = alpha * sparse + (1 - alpha) * dense
            combined_scores.append(combined)
        
        return combined_scores
    
    def _min_max_normalize(self, scores: List[float]) -> List[float]:
        """Normalize scores to 0-1 range using min-max scaling"""
        if not scores:
            return scores
        
        min_score = min(scores)
        max_score = max(scores)
        
        if max_score == min_score:
            return [0.5] * len(scores)
        
        return [(score - min_score) / (max_score - min_score) for score in scores]
    
    def hybrid_search(self, 
                     query: str, 
                     chunks: List[Dict], 
                     top_k: int = 10,
                     fusion_method: str = "rrf",
                     alpha: float = 0.4) -> List[Tuple[Dict, float]]:
        """
        Perform hybrid search using both dense and sparse retrieval
        
        Args:
            query: Search query
            chunks: List of chunks with embeddings
            top_k: Number of results to return
            fusion_method: "rrf" or "weighted"
            alpha: Weight for sparse scores in weighted combination (0-1)
        
        Returns:
            List of (chunk, score) tuples sorted by relevance
        """
        if not chunks:
            return []
        
        # Dense retrieval (vector search)
        dense_scores = self._dense_retrieval(query, chunks)
        
        # Sparse retrieval (BM25)
        sparse_scores = self._sparse_retrieval(query, chunks)
        
        # Fusion
        if fusion_method == "rrf":
            combined_scores = self.reciprocal_rank_fusion(dense_scores, sparse_scores)
        elif fusion_method == "weighted":
            combined_scores = self.weighted_combination(dense_scores, sparse_scores, alpha)
        else:
            raise ValueError(f"Unknown fusion method: {fusion_method}")
        
        # Combine chunks with scores and sort
        scored_chunks = list(zip(chunks, combined_scores))
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        
        return scored_chunks[:top_k]
    
    def _dense_retrieval(self, query: str, chunks: List[Dict]) -> List[float]:
        """Perform dense retrieval using vector similarity"""
        # Generate query embedding
        query_embedding = self.embedding_model.embed_query(query)
        query_embedding_norm = np.array(query_embedding) / np.linalg.norm(query_embedding)
        
        # Calculate cosine similarities
        similarities = []
        for chunk in chunks:
            if "embedding" in chunk:
                chunk_embedding = np.array(chunk["embedding"])
                similarity = np.dot(query_embedding_norm, chunk_embedding)
                similarities.append(similarity)
            else:
                similarities.append(0.0)
        
        return similarities
    
    def _sparse_retrieval(self, query: str, chunks: List[Dict]) -> List[float]:
        """Perform sparse retrieval using BM25"""
        # Build BM25 index if not already built
        if not hasattr(self, 'bm25_index') or not hasattr(self, 'bm25_chunks'):
            self.bm25_index = self.build_bm25_index(chunks)
            self.bm25_chunks = chunks
        
        # Get BM25 scores
        tokenized_query = self.tokenize_text(query)
        bm25_scores = self.bm25_index.get_scores(tokenized_query)
        
        return bm25_scores.tolist()
    
    def process_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """Process chunks and generate embeddings + BM25 index"""
        texts = [chunk["content"] for chunk in chunks]
        
        # Generate embeddings
        embeddings = self.generate_embeddings_batch(texts)
        normalized_embeddings = self.normalize_embeddings(embeddings)
        
        # Add embeddings to chunks
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = normalized_embeddings[i]
            chunk["metadata"]["embedding_dim"] = len(normalized_embeddings[i])
        
        # Build BM25 index for future sparse retrieval
        self.bm25_index = self.build_bm25_index(chunks)
        self.bm25_chunks = chunks
        
        return chunks

    def analyze_query_type(self, query: str) -> Dict[str, Any]:
        """
        Analyze query to determine optimal hybrid search parameters
        Returns suggested fusion method and weights
        """
        tokens = self.tokenize_text(query)
        
        # Check for exact match patterns
        has_codes = any(re.search(r'[A-Z]{2,}-\d+|[A-Z]{3,}', token) for token in tokens)
        has_versions = any(re.search(r'\d+\.\d+\.\d+|\bv\d+', token) for token in tokens)
        has_acronyms = any(len(token) <= 4 and token.isupper() for token in tokens)
        has_numbers = any(token.isdigit() for token in tokens)
        
        exact_match_indicators = has_codes or has_versions or has_acronyms or has_numbers
        
        # Semantic query indicators
        is_semantic = len(tokens) > 3 and not exact_match_indicators
        has_question_words = any(word in query.lower() for word in ['how', 'what', 'why', 'when', 'where'])
        
        if exact_match_indicators:
            # Prefer BM25 for exact matches
            return {
                "fusion_method": "weighted",
                "alpha": 0.6,  # Higher weight for sparse
                "query_type": "exact_match"
            }
        elif is_semantic or has_question_words:
            # Prefer dense for semantic queries
            return {
                "fusion_method": "weighted", 
                "alpha": 0.3,  # Higher weight for dense
                "query_type": "semantic"
            }
        else:
            # Balanced approach
            return {
                "fusion_method": "rrf",
                "alpha": 0.4,
                "query_type": "balanced"
            }