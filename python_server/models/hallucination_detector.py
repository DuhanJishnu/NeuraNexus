from typing import Dict, Any, List

class HallucinationDetector:
    def __init__(self):
        self.validation_prompt = self._create_validation_prompt()
    
    def _create_validation_prompt(self) -> str:
        """Create prompt for fact validation against context"""
        template = """Analyze the following answer and determine if it is fully supported by the provided context. 
        Check for any information that might be made up or not directly supported by the context.

        Context:
        {context}

        Question: {question}
        Proposed Answer: {answer}

        Instructions:
        1. Identify each factual claim in the answer
        2. Check if each claim is directly supported by the context
        3. Flag any claims that are not supported or are contradictory
        4. Provide a confidence score (0-100%) for the answer's accuracy

        Response format:
        - Supported Claims: [list of supported claims]
        - Unsupported Claims: [list of unsupported claims or "None"]
        - Confidence Score: [percentage]
        - Validation Result: [PASS/CAUTION/FAIL]"""

        return template
    
    def create_safety_prompt(self) -> str:
        """Create main prompt with anti-hallucination instructions"""
        template = """You are a careful AI assistant that strictly bases answers on the provided context. 
        Follow these rules:
        1. ONLY use information from the provided context
        2. If the context doesn't contain the answer, say "I cannot answer based on the provided documents"
        3. Never make up information, names, dates, or facts
        4. If you're uncertain, express the uncertainty
        5. Always cite your sources using [source_number] format

        Context Information:
        {context}

        User Question: {question}

        Important: If the context is insufficient or irrelevant to the question, 
        respond with: "I cannot provide a reliable answer based on the available documents."

        Otherwise, provide a helpful answer with citations:"""

        return template
