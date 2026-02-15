"""
Семантический поиск по всему корпусу знаний:
  - этические принципы
  - аяты Корана
  - хадисы Пророка

Используется TF-IDF + косинусное сходство для ранжирования.
"""

import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from knowledge_base.corpus import get_all_principle_entries
from knowledge_base.quran_data import get_all_quran_entries
from knowledge_base.hadith_data import get_all_hadith_entries


class KnowledgeSearch:
    """Семантический поиск по базе знаний."""

    def __init__(self):
        self.entries = []
        self.vectorizer = None
        self.tfidf_matrix = None
        self._build_index()

    def _build_index(self):
        """Построить TF-IDF индекс по всем источникам."""
        self.entries = (
            get_all_principle_entries()
            + get_all_quran_entries()
            + get_all_hadith_entries()
        )

        # Собираем тексты для индексации: content + tags
        documents = []
        for entry in self.entries:
            text_parts = [entry.get("content", "")]
            text_parts.extend(entry.get("tags", []))
            documents.append(" ".join(text_parts))

        self.vectorizer = TfidfVectorizer(
            lowercase=True,
            token_pattern=r"(?u)\b\w[\w-]*\b",
            max_df=0.95,
            min_df=1,
            ngram_range=(1, 2),
        )
        self.tfidf_matrix = self.vectorizer.fit_transform(documents)

    def search(self, query: str, top_k: int = 8) -> list[dict]:
        """
        Найти top_k наиболее релевантных записей для запроса.

        Возвращает список словарей:
          {id, source_type, title, content, reference, score, ...}
        """
        query_vec = self.vectorizer.transform([query.lower()])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        # Индексы top_k по убыванию
        top_indices = similarities.argsort()[-top_k:][::-1]

        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.0:
                entry = dict(self.entries[idx])
                entry["relevance_score"] = round(score, 4)
                results.append(entry)

        return results

    def get_stats(self) -> dict:
        """Статистика базы знаний."""
        counts = {}
        for e in self.entries:
            t = e.get("source_type", "unknown")
            counts[t] = counts.get(t, 0) + 1
        return {
            "total_entries": len(self.entries),
            "by_type": counts,
        }


# Singleton
_search_instance = None


def get_search() -> KnowledgeSearch:
    """Получить экземпляр поиска (singleton)."""
    global _search_instance
    if _search_instance is None:
        _search_instance = KnowledgeSearch()
    return _search_instance
