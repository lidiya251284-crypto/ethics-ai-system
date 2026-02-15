"""
Утилита логирования — прозрачная запись каждого шага работы агентов.
"""

import json
import time
from datetime import datetime, timezone


class TransparentLogger:
    """Записывает каждый шаг агента с timestamp, agent_name, input, output."""

    def __init__(self):
        self.logs: list[dict] = []

    def log(self, agent_name: str, action: str, input_data: any = None, output_data: any = None):
        """Записать шаг."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": agent_name,
            "action": action,
            "input_summary": self._summarize(input_data),
            "output_summary": self._summarize(output_data),
        }
        self.logs.append(entry)
        return entry

    def _summarize(self, data) -> str:
        """Краткое описание данных для лога."""
        if data is None:
            return ""
        if isinstance(data, str):
            return data[:200] + ("..." if len(data) > 200 else "")
        if isinstance(data, dict):
            return json.dumps(data, ensure_ascii=False, default=str)[:300]
        if isinstance(data, list):
            return f"[{len(data)} items]"
        return str(data)[:200]

    def get_logs(self) -> list[dict]:
        """Получить все логи."""
        return self.logs

    def clear(self):
        """Очистить логи."""
        self.logs = []


# Singleton
_logger_instance = None


def get_logger() -> TransparentLogger:
    """Получить экземпляр логгера."""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = TransparentLogger()
    return _logger_instance
