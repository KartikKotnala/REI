"""
Vector Knowledge Base for SmartFix Code Base.
Vectorizes AST entities and code chunks, providing fast semantic similarity retrieval over repository code.
"""

from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from backend.parser.repo_parser import parse_smartfix_repository


class VectorKnowledgeBase:
    def __init__(self, parser_data: Dict[str, Any]):
        self.entities: List[Dict[str, Any]] = [
            e for e in parser_data["entities"] if e["type"] in ["function", "class", "variable", "attribute", "endpoint"]
        ]
        self.documents: List[str] = []
        self.vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b", stop_words=None)

        for entity in self.entities:
            # Combine signature, name, docstring, and code snippet into vector document
            doc = f"{entity['name']} {entity.get('signature', '')} {entity.get('docstring', '')} {entity.get('snippet', '')}"
            self.documents.append(doc)

        if self.documents:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.documents)
        else:
            self.tfidf_matrix = None

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.tfidf_matrix is None or not query:
            return []

        query_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0.01:
                entity = self.entities[idx]
                results.append({
                    "id": entity["id"],
                    "name": entity["name"],
                    "type": entity["type"],
                    "file_path": entity["file_path"],
                    "signature": entity.get("signature", ""),
                    "snippet": entity.get("snippet", "")[:200] + "...",
                    "similarity_score": round(score, 4),
                })
        return results


def build_smartfix_vector_kb() -> VectorKnowledgeBase:
    parser_data = parse_smartfix_repository()
    kb = VectorKnowledgeBase(parser_data)
    return kb


if __name__ == "__main__":
    kb = build_smartfix_vector_kb()
    print(f"Vector Knowledge Base built with {len(kb.entities)} indexed code entities.")
    query = "safety engine rules blocked evaluation"
    results = kb.search(query, top_k=3)
    print(f"Sample query: '{query}' -> Found {len(results)} matches:")
    for r in results:
        print(f"  [{r['similarity_score']}] {r['type'].upper()}: {r['name']} ({r['file_path']})")
