/**
 * Фикх-Помощник — Node.js сервер с Groq AI
 * 
 * Запуск: node server.js
 * Откройте: http://localhost:3000
 */

const express = require("express");
const https = require("https");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Groq Config ─────────────────────────────────────────────
const GROQ_URL = "api.groq.com";
const GROQ_PATH = "/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

let GROQ_API_KEY = "";

const SYSTEM_PROMPT = `Ты — учёный-факих (специалист по исламскому праву / фикху). Твоя задача — отвечать на вопросы пользователей по исламскому праву (фикху).

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

6. Будь объективен — не навязывай один мазхаб.

7. Форматируй ответ с **жирным** выделением, списками и подзаголовками.`;

// ── Load API Key ────────────────────────────────────────────
function loadKey() {
    // 1. Environment variable
    if (process.env.GROQ_API_KEY) {
        GROQ_API_KEY = process.env.GROQ_API_KEY;
        return;
    }
    // 2. .env file
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf-8").split("\n");
        for (const line of lines) {
            const match = line.match(/^GROQ_API_KEY\s*=\s*(.+)/);
            if (match) { GROQ_API_KEY = match[1].trim().replace(/^["']|["']$/g, ""); return; }
        }
    }
}

// ── Groq API Call ───────────────────────────────────────────
function callGroq(messages) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: GROQ_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048,
        });

        const options = {
            hostname: GROQ_URL,
            path: GROQ_PATH,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Length": Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    if (res.statusCode === 200 && data.choices?.[0]?.message?.content) {
                        resolve(data.choices[0].message.content);
                    } else if (res.statusCode === 429) {
                        resolve("⏳ Слишком много запросов. Подождите минуту и попробуйте снова.");
                    } else if (res.statusCode === 401 || res.statusCode === 403) {
                        resolve("🔑 Неверный API-ключ Groq. Проверьте файл .env");
                    } else {
                        resolve(`❌ Ошибка API (${res.statusCode}): ${(data.error?.message || body).substring(0, 200)}`);
                    }
                } catch (e) {
                    resolve(`❌ Ошибка парсинга ответа: ${e.message}`);
                }
            });
        });

        req.on("error", (e) => resolve(`❌ Ошибка сети: ${e.message}`));
        req.setTimeout(30000, () => { req.destroy(); resolve("⏳ Таймаут — сервер не ответил за 30 сек."); });
        req.write(payload);
        req.end();
    });
}

// ── Routes ──────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/chat", async (req, res) => {
    if (!GROQ_API_KEY) {
        return res.json({ status: "error", message: "🔑 API-ключ не настроен. Добавьте GROQ_API_KEY в файл .env" });
    }

    const { message, history } = req.body;
    if (!message) return res.json({ status: "error", message: "Пустое сообщение" });

    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add conversation history (last 20)
    if (history && Array.isArray(history)) {
        for (const msg of history.slice(-20)) {
            messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.text || "" });
        }
    }
    messages.push({ role: "user", content: message });

    const reply = await callGroq(messages);
    res.json({ status: "ok", message: reply });
});

app.post("/api/set-key", (req, res) => {
    const { key } = req.body;
    if (!key || !key.startsWith("gsk_")) {
        return res.json({ status: "error", message: "Ключ должен начинаться с gsk_" });
    }

    // Save to .env
    const envPath = path.join(__dirname, ".env");
    fs.writeFileSync(envPath, `GROQ_API_KEY=${key}\n`, "utf-8");
    GROQ_API_KEY = key;
    console.log("  ✅ API-ключ сохранён в .env");
    res.json({ status: "ok", message: "Ключ сохранён!" });
});

app.get("/api/status", (req, res) => {
    res.json({ status: "ok", has_key: !!GROQ_API_KEY, model: GROQ_MODEL });
});

// ── Start ───────────────────────────────────────────────────
const PORT = 3000;

loadKey();
app.listen(PORT, () => {
    console.log();
    console.log("  ☪️  Фикх-Помощник");
    console.log(`  🌐  http://localhost:${PORT}`);
    console.log(`  🤖  Модель: ${GROQ_MODEL}`);
    if (GROQ_API_KEY) {
        console.log(`  🔑  API-ключ: ${GROQ_API_KEY.substring(0, 12)}...`);
    } else {
        console.log("  ⚠️   API-ключ НЕ найден!");
        console.log("       Откройте http://localhost:3000 и введите ключ в настройках");
        console.log("       Получить ключ: https://console.groq.com/keys");
    }
    console.log();
});
