"""
Flask сервер для Ethics AI System.

Endpoints:
  GET  /          — UI страница
  POST /api/analyze — анализ ситуации
  GET  /api/stats   — статистика базы знаний
"""

from flask import Flask, request, jsonify, render_template
from coordinator.pipeline import Pipeline
from knowledge_base.search import get_search
import config

app = Flask(__name__)
pipeline = Pipeline()


@app.route("/")
def index():
    """Главная страница."""
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """Анализ моральной дилеммы."""
    data = request.get_json()
    if not data or not data.get("situation"):
        return jsonify({
            "status": "error",
            "message": "Пожалуйста, опишите ситуацию в поле 'situation'."
        }), 400

    situation = data["situation"].strip()
    if len(situation) < 10:
        return jsonify({
            "status": "error",
            "message": "Опишите ситуацию более подробно (минимум 10 символов)."
        }), 400

    try:
        result = pipeline.run(situation)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Ошибка обработки: {str(e)}"
        }), 500


@app.route("/api/stats", methods=["GET"])
def stats():
    """Статистика базы знаний."""
    search = get_search()
    return jsonify(search.get_stats())


if __name__ == "__main__":
    print(f"\n  📊 Ethics AI System")
    print(f"  🌐 http://{config.HOST}:{config.PORT}")
    print(f"  ⚙️  Debug: {config.DEBUG}\n")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
