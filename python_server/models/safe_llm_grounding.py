from .gemini_client import GeminiLLM
from config import Config
from typing import List, Dict, Any
from .hallucination_detector import HallucinationDetector
import re

class SafeLLMGrounding:
    def __init__(self, model_name: str = Config.LLM_MODEL):
        self.llm = GeminiLLM(model=model_name)
        self.hallucination_detector = HallucinationDetector()
        self.prompt_template = self.hallucination_detector.create_safety_prompt()
    
    def generate_safe_response(self, question: str, retrieved_docs: List[Dict], 
                             confidence_metrics: Dict) -> Dict[str, Any]:
        """Generate response with multiple safety checks"""
        
        # Check if we should proceed based on confidence
        if not confidence_metrics.get("should_proceed", False):
            return self._create_low_confidence_response(confidence_metrics)
        
        formatted_context = self._format_context_with_citations(retrieved_docs)
        
        try:
            # Generate initial response
            prompt = self.prompt_template.format(
                context=formatted_context,
                question=question
            )
            
            response = self.llm.invoke(prompt)
            
            # Check for refusal patterns
            if self._is_refusal_response(response):
                return {
                    "answer": response,
                    "citations": [],
                    "retrieved_documents": [],
                    "confidence_level": "low",
                    "safety_check": "passed",
                    "refusal_reason": "LLM determined context is insufficient"
                }
            
            # Extract citations and validate
            citations = self._extract_citations(response, retrieved_docs)
            
            # Simple hallucination check (can be enhanced with validation LLM call)
            hallucination_risk = self._assess_hallucination_risk(response, citations, retrieved_docs)
            
            # Determine confidence level
            confidence_level = self._determine_confidence_level(
                confidence_metrics, hallucination_risk, citations
            )
            
            return {
                "answer": response,
                "citations": citations,
                "retrieved_documents": self._format_retrieved_docs(retrieved_docs),
                "confidence_level": confidence_level,
                "safety_check": "passed" if hallucination_risk == "low" else "caution",
                "hallucination_risk": hallucination_risk,
                "retrieval_confidence": confidence_metrics["overall_confidence"]
            }

        except Exception as e:
            return {
                "answer": f"Error generating response: {str(e)}",
                "citations": [],
                "retrieved_documents": [],
                "confidence_level": "very_low",
                "safety_check": "failed",
                "error": str(e)
            }

    def generate_safe_response_stream(
        self, question: str, retrieved_docs: List[Dict], confidence_metrics: Dict
    ):
        """Stream only after retrieval confidence has passed the safety gate."""
        if not confidence_metrics.get("should_proceed", False):
            yield self._create_low_confidence_response(confidence_metrics)["answer"]
            return
        prompt = self.prompt_template.format(
            context=self._format_context_with_citations(retrieved_docs),
            question=question,
        )
        yield from self.llm.stream(prompt)

    def citations_for_response(self, response: str, retrieved_docs: List[Dict]):
        return self._extract_citations(response, retrieved_docs)
    
    def _create_low_confidence_response(self, confidence_metrics: Dict) -> Dict[str, Any]:
        """Create response when confidence is too low"""
        message = f"""I cannot provide a reliable answer based on the available documents. 

Reason: {confidence_metrics.get('proceed_message', 'Low confidence in retrieved information')}

Retrieval Confidence: {confidence_metrics.get('overall_confidence', 0):.1%}
Maximum Similarity: {confidence_metrics.get('max_similarity', 0):.1%}

Please try:
- Rephrasing your question
- Asking about a different topic
- Providing more specific context"""

        return {
            "answer": message,
            "citations": [],
            "retrieved_documents": [],
            "confidence_level": "very_low",
            "safety_check": "failed",
            "retrieval_confidence": confidence_metrics.get("overall_confidence", 0)
        }
    
    def _is_refusal_response(self, response: str) -> bool:
        """Check if the response is a refusal due to insufficient context"""
        refusal_indicators = [
            "cannot answer",
            "based on the provided",
            "no information",
            "not contained",
            "insufficient",
            "unable to provide"
        ]
        
        response_lower = response.lower()
        return any(indicator in response_lower for indicator in refusal_indicators)
    
    def _assess_hallucination_risk(self, response: str, citations: List[Dict], 
                                 retrieved_docs: List[Dict]) -> str:
        """Assess risk of hallucination based on simple heuristics"""
        
        # Check if response has citations but shouldn't (refusal case)
        if self._is_refusal_response(response) and citations:
            return "high"
        
        # Check citation density
        citation_density = len(citations) / (len(response.split()) / 100)  # citations per 100 words
        if citation_density < 1.0 and len(response.split()) > 50:
            return "medium"
        
        # Check if specific claims are made without citations
        claim_indicators = ["research shows", "studies indicate", "data suggests", "proves that"]
        response_lower = response.lower()
        has_claims = any(indicator in response_lower for indicator in claim_indicators)
        
        if has_claims and not citations:
            return "high"
        
        return "low"
    
    def _determine_confidence_level(self, confidence_metrics: Dict, 
                                  hallucination_risk: str, citations: List[Dict]) -> str:
        """Determine overall confidence level"""
        retrieval_conf = confidence_metrics.get("overall_confidence", 0)
        
        if retrieval_conf < 0.4 or hallucination_risk == "high":
            return "very_low"
        elif retrieval_conf < 0.6 or hallucination_risk == "medium":
            return "low"
        elif retrieval_conf < 0.8:
            return "medium"
        else:
            return "high"
    
    def _format_context_with_citations(self, retrieved_docs: List[Dict]) -> str:
        """Format context with citation markers"""
        context_parts = []
        
        for i, doc in enumerate(retrieved_docs, 1):
            metadata = doc["metadata"]
            source_info = f"Source [{i}]: {metadata.get('original_filename', 'Document')}"
            if 'page_number' in metadata:
                source_info += f" (Page {metadata['page_number']})"
            
            context_parts.append(f"{source_info}\n{doc['content']}\n")
        
        return "\n".join(context_parts)
    
    def _extract_citations(self, response: str, retrieved_docs: List[Dict]) -> List[Dict]:
        """Extract citation information from response"""
        citations = []
        
        for i in range(1, len(retrieved_docs) + 1):
            if f"[{i}]" in response:
                doc_metadata = retrieved_docs[i-1]["metadata"]
                citations.append({
                    "citation_id": i,
                    "source_filename": doc_metadata.get("original_filename", "Unknown"),
                    "page_number": doc_metadata.get("page_number"),
                    "source_url": doc_metadata.get("source_url", "#"),
                    "similarity_score": retrieved_docs[i-1].get("similarity_score", 0)
                })
        
        return citations
    
    def _format_retrieved_docs(self, retrieved_docs: List[Dict]) -> List[Dict]:
        """Format retrieved documents for response"""
        return [
            {
                "content_preview": doc["content"][:200] + "..." if len(doc["content"]) > 200 else doc["content"],
                "metadata": doc["metadata"],
                "similarity_score": doc.get("similarity_score", 0),
                "relevance_score": doc.get("relevance_score", 0),
                "citation_id": i + 1
            }
            for i, doc in enumerate(retrieved_docs)
        ]
