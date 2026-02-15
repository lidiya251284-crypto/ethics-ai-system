"""
Координатор агентов — управляет конвейером обработки.

Логика:
  1. Агент-Аналитик → структурирует ситуацию
  2. Агент-Интерпретатор Ценностей → находит релевантные источники
  3. Агент-Рефлексии → генерирует вопросы для размышления
  4. Собирает итоговый отчёт с дисклеймером
"""

from datetime import datetime, timezone
from agents.analyst import AnalystAgent
from agents.values_interpreter import ValuesInterpreterAgent
from agents.reflection import ReflectionAgent
from utils.logger import get_logger


class Pipeline:
    """Координатор, управляющий последовательным вызовом агентов."""

    def __init__(self):
        self.analyst = AnalystAgent()
        self.values = ValuesInterpreterAgent()
        self.reflection = ReflectionAgent()
        self.logger = get_logger()

    def run(self, situation: str) -> dict:
        """
        Запустить полный конвейер обработки моральной дилеммы.

        Args:
            situation: описание ситуации на естественном языке

        Returns:
            Полный структурированный отчёт
        """
        self.logger.clear()
        self.logger.log("Координатор", "Запуск конвейера", situation)
        start_time = datetime.now(timezone.utc)

        # ─── Шаг 1: Анализ ──────────────────────────────────────────
        self.logger.log("Координатор", "Шаг 1 → Агент-Аналитик")
        analyst_result = self.analyst.process({
            "situation": situation,
        })

        # ─── Шаг 2: Интерпретация ценностей ─────────────────────────
        self.logger.log("Координатор", "Шаг 2 → Агент-Интерпретатор Ценностей")
        values_result = self.values.process({
            "situation": situation,
            "analyst_result": analyst_result,
        })

        # ─── Шаг 3: Рефлексия ───────────────────────────────────────
        self.logger.log("Координатор", "Шаг 3 → Агент-Рефлексии")
        reflection_result = self.reflection.process({
            "situation": situation,
            "analyst_result": analyst_result,
            "values_result": values_result,
        })

        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()

        # ─── Итоговый отчёт ──────────────────────────────────────────
        report = {
            "status": "success",
            "situation": situation,
            "analysis": analyst_result,
            "values": values_result,
            "reflection": reflection_result,
            "meta": {
                "processing_time_seconds": round(processing_time, 3),
                "timestamp": start_time.isoformat(),
                "agents_used": [
                    self.analyst.name,
                    self.values.name,
                    self.reflection.name,
                ],
            },
            "disclaimer": (
                "⚠️ ВАЖНО: Данный анализ предназначен для помощи в размышлении "
                "и НЕ ЯВЛЯЕТСЯ окончательным моральным суждением. "
                "Система не заменяет вашу совесть, консультацию с учёными "
                "или юридическую помощь. Финальное решение всегда остаётся за вами."
            ),
            "logs": self.logger.get_logs(),
        }

        self.logger.log("Координатор", "Конвейер завершён",
                        output_data=f"Время: {processing_time:.3f}с")
        return report
