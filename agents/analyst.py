"""
Агент-Аналитик — структурирует описание ситуации.

Функции:
  - выделяет участников и заинтересованные стороны
  - выявляет конфликтные элементы
  - моделирует потенциальные последствия
  - предоставляет нейтральный логический анализ
"""

import re
from agents.base_agent import BaseAgent


class AnalystAgent(BaseAgent):
    """Структурный анализатор этических ситуаций."""

    def __init__(self):
        super().__init__(
            name="Агент-Аналитик",
            description="Структурирует описание ситуации, выделяет участников, конфликты и последствия."
        )

        # Маркеры для анализа
        self._stakeholder_markers = [
            "я", "мы", "он", "она", "они", "коллега", "друг", "родители", "мать",
            "отец", "брат", "сестра", "начальник", "руководитель", "клиент",
            "сотрудник", "партнёр", "сосед", "ребёнок", "семья", "муж", "жена",
            "врач", "пациент", "учитель", "ученик", "продавец", "покупатель",
            "компания", "организация", "общество", "государство", "человек",
        ]

        self._conflict_markers = [
            "но", "однако", "хотя", "несмотря", "вопреки", "конфликт", "дилемма",
            "противоречие", "проблема", "сложность", "трудность", "выбор",
            "с одной стороны", "с другой стороны", "между", "или", "либо",
            "не знаю", "сомневаюсь", "не уверен", "как быть", "что делать",
            "правильно ли", "стоит ли", "допустимо ли", "можно ли",
            "обман", "ложь", "скрыть", "промолчать", "предать", "украсть",
            "навредить", "нарушить", "простить", "наказать",
        ]

        self._consequence_markers = [
            "последствия", "результат", "итог", "повлечёт", "приведёт",
            "к чему", "что будет", "если", "пострадает", "выиграет",
            "потеряет", "рискует", "угрожает", "навредит", "поможет",
            "изменит", "улучшит", "ухудшит", "разрушит", "спасёт",
        ]

    def process(self, input_data: dict) -> dict:
        """Анализ ситуации."""
        situation = input_data.get("situation", "")
        self.log("Получена ситуация для анализа", situation)

        # 1. Выделить участников
        stakeholders = self._extract_stakeholders(situation)
        self.log("Извлечены участники", output_data=stakeholders)

        # 2. Определить конфликты
        conflicts = self._identify_conflicts(situation)
        self.log("Определены конфликтные элементы", output_data=conflicts)

        # 3. Моделировать последствия
        consequences = self._model_consequences(situation, stakeholders, conflicts)
        self.log("Смоделированы последствия", output_data=consequences)

        # 4. Краткое резюме
        summary = self._create_summary(situation, stakeholders, conflicts)

        result = self.create_output({
            "situation_summary": summary,
            "stakeholders": stakeholders,
            "conflicts": conflicts,
            "potential_consequences": consequences,
            "analysis_note": "Это структурный анализ ситуации. Он не содержит моральных оценок.",
        })

        self.log("Анализ завершён", output_data=result)
        return result

    def _extract_stakeholders(self, text: str) -> list[dict]:
        """Выделить участников и их роли."""
        text_lower = text.lower()
        found = []
        seen = set()

        for marker in self._stakeholder_markers:
            pattern = r'\b' + re.escape(marker) + r'\b'
            if re.search(pattern, text_lower) and marker not in seen:
                seen.add(marker)
                role = self._classify_stakeholder_role(marker)
                found.append({
                    "name": marker.capitalize(),
                    "role": role,
                    "involvement": "Упомянут в ситуации",
                })

        # Если ничего не найдено, добавить общие
        if not found:
            found.append({
                "name": "Автор ситуации",
                "role": "Главное действующее лицо",
                "involvement": "Лицо, описывающее ситуацию",
            })

        return found

    def _classify_stakeholder_role(self, marker: str) -> str:
        """Определить тип роли."""
        family = {"родители", "мать", "отец", "брат", "сестра", "семья", "муж", "жена", "ребёнок"}
        work = {"коллега", "начальник", "руководитель", "клиент", "сотрудник", "компания", "организация"}
        social = {"друг", "сосед", "общество", "государство", "человек", "партнёр"}
        professional = {"врач", "пациент", "учитель", "ученик", "продавец", "покупатель"}

        if marker in family:
            return "Семейная роль"
        if marker in work:
            return "Рабочая/деловая роль"
        if marker in social:
            return "Социальная роль"
        if marker in professional:
            return "Профессиональная роль"
        return "Участник ситуации"

    def _identify_conflicts(self, text: str) -> list[dict]:
        """Выявить конфликтные элементы."""
        text_lower = text.lower()
        conflicts = []

        found_markers = [m for m in self._conflict_markers if m in text_lower]

        if any(m in text_lower for m in ["но", "однако", "хотя", "несмотря"]):
            conflicts.append({
                "type": "Внутреннее противоречие",
                "description": "В ситуации присутствует противопоставление — указание на конфликт между двумя позициями или действиями.",
                "severity": "Средний"
            })

        if any(m in text_lower for m in ["выбор", "дилемма", "или", "либо"]):
            conflicts.append({
                "type": "Дилемма выбора",
                "description": "Ситуация требует выбора между несколькими вариантами действий.",
                "severity": "Высокий"
            })

        if any(m in text_lower for m in ["обман", "ложь", "скрыть", "промолчать"]):
            conflicts.append({
                "type": "Конфликт честности",
                "description": "Ситуация связана с вопросами правдивости, сокрытия информации или обмана.",
                "severity": "Высокий"
            })

        if any(m in text_lower for m in ["навредить", "пострадает", "нарушить"]):
            conflicts.append({
                "type": "Конфликт вреда",
                "description": "Ситуация может привести к причинению вреда одной или нескольким сторонам.",
                "severity": "Высокий"
            })

        if any(m in text_lower for m in ["простить", "наказать"]):
            conflicts.append({
                "type": "Конфликт справедливости",
                "description": "Ситуация связана с выбором между прощением и наказанием.",
                "severity": "Средний"
            })

        if any(m in text_lower for m in ["не знаю", "сомневаюсь", "не уверен", "как быть"]):
            conflicts.append({
                "type": "Моральная неопределённость",
                "description": "Автор ситуации выражает неуверенность в правильности возможных действий.",
                "severity": "Средний"
            })

        if not conflicts:
            conflicts.append({
                "type": "Неявный конфликт",
                "description": "Конфликтные элементы не выражены явно, но ситуация может содержать скрытые противоречия.",
                "severity": "Низкий"
            })

        return conflicts

    def _model_consequences(self, text: str, stakeholders: list, conflicts: list) -> list[dict]:
        """Моделировать потенциальные последствия."""
        consequences = []

        # Для каждого выявленного участника (кроме первых двух уже видны)
        for s in stakeholders[:3]:
            consequences.append({
                "stakeholder": s["name"],
                "possible_positive": f"Решение в пользу {s['name'].lower()} может укрепить отношения и доверие.",
                "possible_negative": f"Игнорирование интересов {s['name'].lower()} может привести к ухудшению отношений.",
            })

        # Общие последствия на основе конфликтов
        for c in conflicts:
            if c["type"] == "Конфликт честности":
                consequences.append({
                    "stakeholder": "Все стороны",
                    "possible_positive": "Честность может укрепить долгосрочное доверие.",
                    "possible_negative": "Правда может временно вызвать боль или конфликт.",
                })
            elif c["type"] == "Конфликт вреда":
                consequences.append({
                    "stakeholder": "Все стороны",
                    "possible_positive": "Предотвращение вреда защитит уязвимые стороны.",
                    "possible_negative": "Бездействие может привести к более серьёзному вреду в будущем.",
                })

        return consequences

    def _create_summary(self, text: str, stakeholders: list, conflicts: list) -> str:
        """Краткое нейтральное описание ситуации."""
        num_s = len(stakeholders)
        num_c = len(conflicts)
        conflict_types = ", ".join([c["type"].lower() for c in conflicts])

        return (
            f"Ситуация затрагивает {num_s} участник(ов)/сторон(у). "
            f"Выявлено {num_c} конфликтный(х) элемент(ов): {conflict_types}. "
            f"Для принятия решения рекомендуется рассмотреть интересы всех сторон."
        )
