"""
Базовый абстрактный класс для всех агентов системы.
"""

from abc import ABC, abstractmethod
from utils.logger import get_logger


class BaseAgent(ABC):
    """Базовый агент с логированием и стандартным интерфейсом."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.logger = get_logger()

    @abstractmethod
    def process(self, input_data: dict) -> dict:
        """
        Обработать входные данные и вернуть результат.

        Args:
            input_data: словарь с входными данными

        Returns:
            словарь с результатом работы агента
        """
        pass

    def log(self, action: str, input_data=None, output_data=None):
        """Записать действие в лог."""
        self.logger.log(self.name, action, input_data, output_data)

    def create_output(self, data: dict) -> dict:
        """Обернуть результат в стандартный формат."""
        return {
            "agent": self.name,
            "description": self.description,
            "result": data,
            "disclaimer": "Данный анализ не является окончательным суждением. Решение остаётся за вами.",
        }
