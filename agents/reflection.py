"""
Агент-Рефлексии — способствует размышлению пользователя.

Функции:
  - задаёт уточняющие вопросы
  - выявляет намерения и возможные моральные последствия
  - ведёт пользователя к осознанному выбору
  - НЕ даёт готовых ответов
"""

from agents.base_agent import BaseAgent


class ReflectionAgent(BaseAgent):
    """Агент-Рефлексии — помогает пользователю осмыслить ситуацию."""

    def __init__(self):
        super().__init__(
            name="Агент-Рефлексии",
            description="Задаёт вопросы для размышления, помогает осознать мотивы и последствия."
        )

    def process(self, input_data: dict) -> dict:
        """Сгенерировать вопросы и рефлексивные подсказки."""
        situation = input_data.get("situation", "")
        analyst_result = input_data.get("analyst_result", {})
        values_result = input_data.get("values_result", {})
        self.log("Начат этап рефлексии", situation)

        # 1. Вопросы о намерениях
        intention_questions = self._generate_intention_questions(situation, analyst_result)
        self.log("Вопросы о намерениях", output_data=intention_questions)

        # 2. Вопросы о последствиях
        consequence_questions = self._generate_consequence_questions(analyst_result)
        self.log("Вопросы о последствиях", output_data=consequence_questions)

        # 3. Вопросы о ценностях
        value_questions = self._generate_value_questions(values_result)
        self.log("Вопросы о ценностях", output_data=value_questions)

        # 4. Метарефлексия — вопросы о самом процессе принятия решения
        meta_questions = self._generate_meta_questions()
        self.log("Метарефлексивные вопросы", output_data=meta_questions)

        result = self.create_output({
            "intention_questions": intention_questions,
            "consequence_questions": consequence_questions,
            "value_questions": value_questions,
            "meta_questions": meta_questions,
            "reflection_note": (
                "Эти вопросы предназначены для размышления. "
                "Не существует единственно \"правильного\" ответа. "
                "Цель — помочь вам глубже понять свои мотивы и возможные последствия."
            ),
        })

        self.log("Рефлексия завершена", output_data=result)
        return result

    def _generate_intention_questions(self, situation: str, analyst_result: dict) -> list[dict]:
        """Вопросы о намерениях и мотивах."""
        questions = []
        text_lower = situation.lower()

        # Базовые вопросы о намерении
        questions.append({
            "question": "Какова ваша главная мотивация в этой ситуации?",
            "purpose": "Понять истинные намерения помогает отделить эмоции от рациональных соображений.",
            "category": "intention"
        })

        questions.append({
            "question": "Если бы никто не узнал о вашем решении, поступили бы вы так же?",
            "purpose": "Этот вопрос помогает оценить, движет ли вами внутреннее убеждение или внешнее давление.",
            "category": "intention"
        })

        # Контекстные вопросы
        result_data = analyst_result.get("result", {})
        stakeholders = result_data.get("stakeholders", [])
        if len(stakeholders) > 1:
            questions.append({
                "question": "Чьи интересы для вас наиболее важны в этой ситуации и почему?",
                "purpose": "Определение приоритетов между заинтересованными сторонами.",
                "category": "intention"
            })

        if any(word in text_lower for word in ["скрыть", "обман", "ложь", "промолчать"]):
            questions.append({
                "question": "Что именно вы хотите защитить, скрывая информацию? Себя или другого?",
                "purpose": "Различение защитной лжи и эгоистичного обмана.",
                "category": "intention"
            })

        if any(word in text_lower for word in ["простить", "наказать", "месть"]):
            questions.append({
                "question": "Ваше желание — восстановить справедливость или ответить на боль?",
                "purpose": "Различение стремления к справедливости и мести.",
                "category": "intention"
            })

        return questions

    def _generate_consequence_questions(self, analyst_result: dict) -> list[dict]:
        """Вопросы о последствиях."""
        questions = []

        questions.append({
            "question": "Как ваше решение повлияет на ситуацию через неделю? Через год? Через десять лет?",
            "purpose": "Краткосрочные и долгосрочные последствия могут сильно различаться.",
            "category": "consequences"
        })

        questions.append({
            "question": "Кто, кроме непосредственных участников, может быть затронут вашим решением?",
            "purpose": "Последствия часто распространяются шире, чем кажется.",
            "category": "consequences"
        })

        result_data = analyst_result.get("result", {})
        consequences = result_data.get("potential_consequences", [])
        if consequences:
            questions.append({
                "question": "Какой из выявленных рисков для вас наименее допустим?",
                "purpose": "Определение красных линий помогает сузить пространство решений.",
                "category": "consequences"
            })

        questions.append({
            "question": "Если бы вы узнали о подобном решении другого человека, как бы вы его оценили?",
            "purpose": "Взгляд со стороны часто открывает новые перспективы.",
            "category": "consequences"
        })

        return questions

    def _generate_value_questions(self, values_result: dict) -> list[dict]:
        """Вопросы о ценностях на основе найденных источников."""
        questions = []

        questions.append({
            "question": "Какие из ваших жизненных ценностей наиболее затронуты этой ситуацией?",
            "purpose": "Осознание собственной системы ценностей помогает принять согласованное решение.",
            "category": "values"
        })

        # Вопросы на основе найденных источников
        result_data = values_result.get("result", {})
        sources = result_data.get("relevant_sources", {})

        if "quran" in sources:
            questions.append({
                "question": "Какой из приведённых аятов Корана наиболее резонирует с вашим ощущением ситуации?",
                "purpose": "Личная связь с текстом может подсказать направление размышления.",
                "category": "values"
            })

        if "hadith" in sources:
            questions.append({
                "question": "Какой пример из жизни Пророка ﷺ приходит вам на ум в связи с этой ситуацией?",
                "purpose": "Пророческие примеры дают практические ориентиры.",
                "category": "values"
            })

        questions.append({
            "question": "Если бы вы объясняли своё решение человеку, которого уважаете больше всего — что бы вы сказали?",
            "purpose": "Этот мысленный эксперимент помогает проверить решение на внутреннюю честность.",
            "category": "values"
        })

        return questions

    def _generate_meta_questions(self) -> list[dict]:
        """Метавопросы о процессе принятия решения."""
        return [
            {
                "question": "Достаточно ли у вас информации для принятия решения, или нужно узнать что-то ещё?",
                "purpose": "Иногда моральная неопределённость — следствие недостатка информации.",
                "category": "meta"
            },
            {
                "question": "Есть ли давление времени, или вы можете позволить себе подумать?",
                "purpose": "Срочность влияет на качество этического решения.",
                "category": "meta"
            },
            {
                "question": "С кем из близких или мудрых людей вы могли бы обсудить эту ситуацию?",
                "purpose": "Совет (шура) — важная часть принятия значимых решений.",
                "category": "meta"
            },
        ]
