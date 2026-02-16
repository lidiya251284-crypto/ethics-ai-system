"""
Фикх-Помощник — Flask + Groq AI сервер.

Endpoints:
  GET  /           — Главная страница (чат)
  POST /api/chat   — Отправка вопроса в AI
"""

import os
import json
from flask import Flask, request, jsonify, render_template, send_from_directory

app = Flask(__name__, static_folder="static", template_folder="templates")

# ── Groq API ────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """Ты — учёный-факих (специалист по исламскому праву / фикху). Твоя задача — отвечать на вопросы пользователей по исламскому праву (фикху).

ПРАВИЛА ОТВЕТОВ:
1. Отвечай ТОЛЬКО на вопросы, связанные с исламским правом, поклонением, морально-этическими нормами ислама. На нерелигиозные вопросы вежливо отклоняй.

2. ВСЕГДА указывай мнения разных мазхабов, если они различаются:
   - Ханафитский мазхаб
   - Маликитский мазхаб
   - Шафиитский мазхаб
   - Ханбалитский мазхаб
   Если мнение единогласное — так и пиши.

3. ОБЯЗАТЕЛЬНО приводи далили (доказательства):
   - Аяты Корана (номер суры и аята)
   - Хадисы (сборник: Бухари, Муслим и т.д.)
   - Мнения авторитетных учёных

4. Если вопрос сложный или неоднозначный — рекомендуй обратиться к компетентному учёному лично.

5. Отвечай на русском языке. Арабские термины давай с переводом.

6. Будь объективен — не навязывай один мазхаб, но можешь указать какое мнение более распространённое.

7. Форматируй ответ с **жирным** выделением, списками и подзаголовками.

8. В конце ответа давай ссылки на авторитетные источники: islamqa.info, islamweb.net"""

# Хранение истории для контекста (в памяти, по session)
conversations = {}


def load_key():
    """Загрузить API ключ из .env файла или переменной окружения."""
    global GROQ_API_KEY
    
    # 1. Из переменной окружения
    if os.getenv("GROQ_API_KEY"):
        GROQ_API_KEY = os.getenv("GROQ_API_KEY")
        return
    
    # 2. Из .env файла
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GROQ_API_KEY="):
                    GROQ_API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return


def call_groq(messages):
    """Вызов Groq API (без внешних зависимостей, через urllib)."""
    import urllib.request
    import urllib.error
    
    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    })
    
    req = urllib.request.Request(
        GROQ_URL,
        data=payload.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        if e.code == 429:
            return "⏳ Слишком много запросов. Подождите минуту и попробуйте снова."
        if e.code in (401, 403):
            return f"🔑 Неверный API-ключ Groq. Проверьте файл .env\n\nОшибка: {body[:200]}"
        return f"❌ Ошибка API ({e.code}): {body[:200]}"
    except Exception as e:
        return f"❌ Ошибка: {str(e)}"


@app.route("/")
def index():
    """Главная страница."""
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Обработка сообщения чата."""
    if not GROQ_API_KEY:
        return jsonify({
            "status": "error",
            "message": "🔑 API-ключ не настроен. Создайте файл .env с GROQ_API_KEY=ваш_ключ"
        }), 400
    
    data = request.get_json()
    if not data or not data.get("message"):
        return jsonify({"status": "error", "message": "Пустое сообщение"}), 400
    
    user_message = data["message"].strip()
    session_id = data.get("session_id", "default")
    history = data.get("history", [])
    
    # Собираем сообщения для отправки
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Добавляем историю (последние 20 сообщений)
    for msg in history[-20:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("text", "")})
    
    # Текущее сообщение
    messages.append({"role": "user", "content": user_message})
    
    # Вызов AI
    response_text = call_groq(messages)
    
    return jsonify({
        "status": "ok",
        "message": response_text
    })


@app.route("/api/status", methods=["GET"])
def status():
    """Проверка статуса сервера и ключа."""
    has_key = bool(GROQ_API_KEY)
    return jsonify({
        "status": "ok",
        "has_key": has_key,
        "model": GROQ_MODEL
    })


if __name__ == "__main__":
    load_key()
    
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 5000))
    
    print()
    print("  ☪️  Фикх-Помощник")
    print(f"  🌐  http://{host}:{port}")
    print(f"  🤖  Модель: {GROQ_MODEL}")
    if GROQ_API_KEY:
        print(f"  🔑  API-ключ: {GROQ_API_KEY[:8]}...")
    else:
        print("  ⚠️   API-ключ НЕ найден!")
        print("       Создайте .env файл с: GROQ_API_KEY=ваш_ключ")
        print("       Получить ключ: https://console.groq.com/keys")
    print()
    
    app.run(host=host, port=port, debug=True)
