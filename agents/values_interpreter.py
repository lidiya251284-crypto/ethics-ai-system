"""
Агент-Интерпретатор Ценностей — сопоставляет ситуацию с корпусом
морально-этических принципов, текстами Корана и хадисами.

Функции:
  - извлекает релевантные принципы, аяты и хадисы
  - показывает различные интерпретации
  - НЕ выносит директивных указаний
  - ясно указывает источники
"""

from agents.base_agent import BaseAgent
from knowledge_base.search import get_search


class ValuesInterpreterAgent(BaseAgent):
    """Интерпретатор ценностей — соединяет ситуацию с этическими источниками."""

    def __init__(self):
        super().__init__(
            name="Агент-Интерпретатор Ценностей",
            description="Сопоставляет ситуацию с этическими принципами, аятами Корана и хадисами."
        )
        self.search = get_search()

    def process(self, input_data: dict) -> dict:
        """Найти релевантные ценности и сформировать интерпретации."""
        situation = input_data.get("situation", "")
        analyst_result = input_data.get("analyst_result", {})
        self.log("Начат поиск релевантных ценностей", situation)

        # 1. Собрать поисковый запрос из ситуации + конфликтов
        search_query = self._build_search_query(situation, analyst_result)
        self.log("Построен поисковый запрос", search_query)

        # 2. Поиск в базе знаний
        search_results = self.search.search(search_query, top_k=10)
        self.log("Найдены релевантные источники", search_results)

        # 3. Группировать по типу источника
        grouped = self._group_by_source(search_results)

        # 4. Сформировать интерпретации
        interpretations = self._build_interpretations(grouped, analyst_result)
        self.log("Сформированы интерпретации", interpretations)

        result = self.create_output({
            "relevant_sources": grouped,
            "interpretations": interpretations,
            "knowledge_stats": self.search.get_stats(),
            "interpretation_note": (
                "Приведённые источники представляют различные точки зрения. "
                "Система не выносит директивных указаний и не определяет "
                "единственно верное решение."
            ),
        })

        self.log("Интерпретация завершена", output_data=result)
        return result

    def _build_search_query(self, situation: str, analyst_result: dict) -> str:
        """Расширить запрос данными от Аналитика."""
        parts = [situation]

        # Добавить типы конфликтов из анализа
        result_data = analyst_result.get("result", {})
        conflicts = result_data.get("conflicts", [])
        for c in conflicts:
            parts.append(c.get("description", ""))

        return " ".join(parts)

    def _group_by_source(self, results: list[dict]) -> dict:
        """Группировать результаты по типу источника."""
        groups = {
            "quran": {"label": "📖 Священный Коран", "items": []},
            "hadith": {"label": "📜 Хадисы Пророка ﷺ", "items": []},
            "principle": {"label": "⚖️ Этические принципы", "items": []},
        }

        for r in results:
            source_type = r.get("source_type", "principle")
            item = {
                "title": r.get("title", ""),
                "content": r.get("content", ""),
                "reference": r.get("reference", ""),
                "relevance": r.get("relevance_score", 0),
            }
            # Добавить арабский текст для Корана и хадисов
            if r.get("arabic"):
                item["arabic_text"] = r["arabic"]
            # Добавить степень достоверности для хадисов
            if r.get("authenticity"):
                item["authenticity"] = r["authenticity"]

            if source_type in groups:
                groups[source_type]["items"].append(item)

        # Убрать пустые группы
        return {k: v for k, v in groups.items() if v["items"]}

    def _build_interpretations(self, grouped: dict, analyst_result: dict) -> list[dict]:
        """Сформировать различные ИНТЕРПРЕТАЦии (не вердикты)."""
        interpretations = []

        # Перспектива Корана
        if "quran" in grouped:
            quran_items = grouped["quran"]["items"]
            interpretations.append({
                "perspective": "Коранический взгляд",
                "description": (
                    f"По данной ситуации найдено {len(quran_items)} релевантных аятов Корана. "
                    "Тексты Корана призывают к размышлению и осознанному выбору, "
                    "подчёркивая важность справедливости, милосердия и ответственности."
                ),
                "key_sources": [item["reference"] for item in quran_items[:3]],
                "note": "Интерпретация аятов может различаться в зависимости от контекста и школы тафсира."
            })

        # Перспектива хадисов
        if "hadith" in grouped:
            hadith_items = grouped["hadith"]["items"]
            interpretations.append({
                "perspective": "Пророческая традиция (Сунна)",
                "description": (
                    f"Найдено {len(hadith_items)} релевантных хадисов. "
                    "Пророческая традиция предоставляет практические примеры "
                    "нравственного поведения и этических решений."
                ),
                "key_sources": [item["reference"] for item in hadith_items[:3]],
                "note": "Каждый хадис имеет степень достоверности и контекст передачи."
            })

        # Философская перспектива
        if "principle" in grouped:
            principle_items = grouped["principle"]["items"]

            # Группировать по традиции
            traditions = set()
            for item in principle_items:
                title = item["title"]
                if ":" in title:
                    traditions.add(title.split(":")[0].strip())

            interpretations.append({
                "perspective": "Философско-этический взгляд",
                "description": (
                    f"Ситуация рассматривается с позиций: {', '.join(traditions) if traditions else 'общей этики'}. "
                    "Различные этические традиции могут давать разные рекомендации."
                ),
                "key_sources": [item["reference"] for item in principle_items[:3]],
                "note": "Философские принципы дополняют, но не заменяют религиозные источники."
            })

        if not interpretations:
            interpretations.append({
                "perspective": "Общее замечание",
                "description": "По данной ситуации не найдено высокорелевантных источников. Рекомендуется консультация со специалистом.",
                "key_sources": [],
                "note": "База знаний может быть расширена для покрытия большего числа тем."
            })

        return interpretations
