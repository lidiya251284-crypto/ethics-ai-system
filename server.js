/**
 * Фикх-Помощник — Node.js сервер (Мульти-провайдер AI)
 * 
 * Поддерживает: DeepSeek (рекомендуется), Groq, Mistral
 * DeepSeek — работает из России, $2 при регистрации
 * 
 * Запуск: node server.js
 * Откройте: http://localhost:3000
 */

const express = require("express");
const https = require("https");
const path = require("path");
const fs = require("fs");

// Offline knowledge base
const FIQH_DB = require("./static/fiqh_db.js");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Offline Search Engine ─────────────────────────────────────
function normalizeText(text) {
    return text.toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^а-яa-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const STEM_MAP = {
    "молитв": "намаз", "молиться": "намаз", "салят": "намаз", "молитва": "намаз",
    "омовени": "вуду", "тахарат": "вуду", "абдест": "вуду",
    "менструаци": "месячные", "хайд": "месячные",
    "ураза": "пост", "рамадан": "пост", "сухур": "пост", "ифтар": "пост",
    "талак": "развод", "разводиться": "развод", "разведен": "развод",
    "нафака": "содержание", "содержит": "содержание", "содержать": "содержание",
    "милостын": "закят", "нисаб": "закят",
    "покрыти": "хиджаб", "аурат": "хиджаб", "платок": "хиджаб", "никаб": "хиджаб",
    "процент": "риба", "кредит": "риба", "ипотек": "риба", "банк": "риба", "ростовщичеств": "риба",
    "полное омовени": "гусль", "джанаба": "гусль", "большое омовени": "гусль", "купани": "гусль",
    "брак": "никах", "свадьб": "никах", "женитьб": "никах", "замуж": "никах", "махр": "никах",
    "мясо": "халяль", "свинин": "халяль", "алкогол": "халяль", "еда": "халяль",
    "песок": "тайаммум", "сухое омовени": "тайаммум",
    "каза": "пропущенный", "возмещени": "пропущенный", "пропущен": "пропущенный",
    "беременн": "беременность", "кормящ": "беременность",
    "песн": "музыка", "нашид": "музыка", "музык": "музыка",
    "путник": "намаз путник", "путешестви": "намаз путник", "сафар": "намаз путник", "сокращени": "намаз путник",
    "похорон": "джаназа", "смерть": "джаназа", "умер": "джаназа",
    "сглаз": "рукъя", "порч": "рукъя", "джинн": "рукъя", "колдовств": "рукъя", "сихр": "рукъя",
    "бород": "борода", "бритье": "борода", "бритв": "борода",
    "сигарет": "курение", "вейп": "курение", "кальян": "курение", "табак": "курение",
    "фотографи": "фото", "изображени": "фото", "рисовани": "фото", "тасвир": "фото",
    "хадж": "хадж", "умра": "хадж", "паломничеств": "хадж", "кааб": "хадж",
    "истихар": "истихара", "выбор": "истихара", "решени": "истихара",
    "собак": "животные", "кошк": "животные", "животн": "животные",
    "суджуд": "суджуд", "саджда": "суджуд", "ошибк": "суджуд", "забыл в намаз": "суджуд",
    "дуа": "дуа", "мольб": "дуа", "просить": "дуа",
};

function searchOfflineDB(query) {
    const normalized = normalizeText(query);
    const words = normalized.split(" ").filter(w => w.length > 2);

    let bestMatch = null;
    let bestScore = 0;

    for (const entry of FIQH_DB) {
        let score = 0;

        // Direct key match
        for (const key of entry.keys) {
            const normKey = normalizeText(key);
            if (normalized.includes(normKey)) {
                score += 3;
            }
            // Partial match
            for (const word of words) {
                if (normKey.includes(word) || word.includes(normKey)) {
                    score += 1;
                }
            }
        }

        // Stem-based match
        for (const word of words) {
            for (const [stem, target] of Object.entries(STEM_MAP)) {
                if (word.includes(stem) || stem.includes(word)) {
                    for (const key of entry.keys) {
                        if (normalizeText(key).includes(normalizeText(target))) {
                            score += 2;
                            break;
                        }
                    }
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
        }
    }

    // Require score >= 2 for a confident match
    if (bestScore >= 2 && bestMatch) {
        return bestMatch;
    }
    return null;
}

// ── Provider Configs ────────────────────────────────────────
const PROVIDERS = {
    deepseek: {
        name: "DeepSeek",
        hostname: "api.deepseek.com",
        path: "/v1/chat/completions",
        model: "deepseek-chat",
        keyPrefix: "sk-",
        signupUrl: "https://platform.deepseek.com/api_keys",
        description: "🇨🇳 Работает из России! При регистрации $2 бонус."
    },
    groq: {
        name: "Groq",
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        model: "llama-3.3-70b-versatile",
        keyPrefix: "gsk_",
        signupUrl: "https://console.groq.com/keys",
        description: "⚡ Быстрый, бесплатный. Может не работать из РФ."
    },
    mistral: {
        name: "Mistral",
        hostname: "api.mistral.ai",
        path: "/v1/chat/completions",
        model: "mistral-small-latest",
        keyPrefix: "",
        signupUrl: "https://console.mistral.ai/api-keys",
        description: "🇫🇷 Французская компания. Бесплатный тариф."
    }
};

let activeProvider = null;
let apiKey = "";

const SYSTEM_PROMPT = `Ты — учёный-факих (специалист по исламскому праву / фикху). Отвечай на русском языке.

ПРАВИЛА:
1. Отвечай ТОЛЬКО на вопросы исламского права, поклонения, этики ислама. Другие — вежливо отклоняй.
2. Указывай мнения 4 мазхабов (Ханафитский, Маликитский, Шафиитский, Ханбалитский), если они различаются.
3. Приводи далили: аяты Корана (сура:аят), хадисы (сборник), мнения учёных.
4. Если вопрос неоднозначный — рекомендуй обратиться к учёному.
5. Отвечай структурировано: **жирный**, списки, подзаголовки.
6. Арабские термины давай с переводом.
7. Будь объективен — не навязывай один мазхаб.`;

// ── Load config from .env ──────────────────────────────────────
function loadConfig() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
        let m = line.match(/^AI_PROVIDER\s*=\s*(.+)/);
        if (m) activeProvider = m[1].trim().replace(/^["']|["']$/g, "");
        m = line.match(/^AI_API_KEY\s*=\s*(.+)/);
        if (m) apiKey = m[1].trim().replace(/^["']|["']$/g, "");
    }
}

function saveConfig(provider, key) {
    const envPath = path.join(__dirname, ".env");
    fs.writeFileSync(envPath, `AI_PROVIDER=${provider}\nAI_API_KEY=${key}\n`, "utf-8");
    activeProvider = provider;
    apiKey = key;
}

// ── AI API Call ────────────────────────────────────────────────
function callAI(provider, key, messages) {
    const cfg = PROVIDERS[provider];
    if (!cfg) return Promise.reject(new Error("Unknown provider: " + provider));

    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: cfg.model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048,
        });

        const req = https.request({
            hostname: cfg.hostname,
            path: cfg.path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
                "Content-Length": Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    if (res.statusCode === 200 && data.choices?.[0]?.message?.content) {
                        resolve({ ok: true, message: data.choices[0].message.content });
                    } else if (res.statusCode === 429) {
                        resolve({ ok: false, message: "⏳ Лимит запросов. Подождите минуту." });
                    } else if (res.statusCode === 401 || res.statusCode === 403) {
                        resolve({ ok: false, message: `🔑 Ошибка авторизации (${res.statusCode}). Проверьте API-ключ для ${cfg.name}.` });
                    } else {
                        resolve({ ok: false, message: `❌ Ошибка ${cfg.name} (${res.statusCode}): ${(data.error?.message || "").substring(0, 200)}` });
                    }
                } catch (e) {
                    resolve({ ok: false, message: `❌ Ошибка ответа от ${cfg.name}` });
                }
            });
        });

        req.on("error", e => resolve({ ok: false, message: `❌ Сеть: ${e.message}` }));
        req.setTimeout(45000, () => { req.destroy(); resolve({ ok: false, message: "⏳ Таймаут 45 сек." }); });
        req.write(payload);
        req.end();
    });
}

// Test if a provider + key works
async function testProvider(provider, key) {
    const cfg = PROVIDERS[provider];
    if (!cfg) return { ok: false, message: "Unknown provider" };

    const result = await callAI(provider, key, [
        { role: "user", content: "Скажи: OK" }
    ]);
    return result;
}

// ── Routes ──────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/status", (req, res) => {
    const configured = !!(activeProvider && apiKey);
    res.json({
        status: "ok",
        configured,
        provider: activeProvider,
        providerName: configured ? PROVIDERS[activeProvider]?.name : null,
        model: configured ? PROVIDERS[activeProvider]?.model : null,
        providers: Object.entries(PROVIDERS).map(([id, p]) => ({
            id, name: p.name, description: p.description, signupUrl: p.signupUrl
        }))
    });
});

app.post("/api/setup", async (req, res) => {
    const { provider, key } = req.body;
    if (!provider || !PROVIDERS[provider]) {
        return res.json({ status: "error", message: "Неверный провайдер" });
    }
    if (!key || key.length < 10) {
        return res.json({ status: "error", message: "Введите API-ключ" });
    }

    console.log(`  🔑 Проверяю ключ для ${PROVIDERS[provider].name}...`);
    const test = await testProvider(provider, key);

    if (test.ok) {
        saveConfig(provider, key);
        console.log(`  ✅ ${PROVIDERS[provider].name} — работает!`);
        res.json({ status: "ok", message: `✅ ${PROVIDERS[provider].name} настроен!`, providerName: PROVIDERS[provider].name });
    } else {
        console.log(`  ❌ ${PROVIDERS[provider].name} — ошибка:`, test.message);
        res.json({ status: "error", message: test.message });
    }
});

app.post("/api/chat", async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.json({ status: "error", message: "Пустое сообщение" });

    // Step 1: Try offline database first (free, instant)
    const offlineResult = searchOfflineDB(message);
    if (offlineResult) {
        console.log(`  📚 Оффлайн: "${offlineResult.title}"`);
        const response = `<strong>${offlineResult.title}</strong><br><br>${offlineResult.answer}<br><br><em style="opacity:0.6">📚 Ответ из базы знаний (бесплатно)</em>`;
        return res.json({ status: "ok", message: response, source: "offline" });
    }

    // Step 2: No offline match → use AI (if configured)
    if (!activeProvider || !apiKey) {
        return res.json({ status: "error", message: "🔍 Тема не найдена в базе знаний. Настройте AI-провайдер (⚙️), чтобы получать ответы на любые вопросы." });
    }

    console.log(`  🤖 AI: "${message.substring(0, 50)}..."`);
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    if (history && Array.isArray(history)) {
        for (const msg of history.slice(-20)) {
            messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.text || "" });
        }
    }
    messages.push({ role: "user", content: message });

    const result = await callAI(activeProvider, apiKey, messages);
    if (result.ok) {
        result.message += "\n\n_🤖 Ответ от AI_";
    }
    res.json({ status: result.ok ? "ok" : "error", message: result.message });
});

// ── Start ───────────────────────────────────────────────────
const PORT = 3000;

loadConfig();
app.listen(PORT, () => {
    console.log();
    console.log("  ☪️  Фикх-Помощник");
    console.log(`  🌐  http://localhost:${PORT}`);
    if (activeProvider && apiKey) {
        const p = PROVIDERS[activeProvider];
        console.log(`  🤖  ${p.name} (${p.model})`);
        console.log(`  🔑  Ключ: ${apiKey.substring(0, 8)}...`);
    } else {
        console.log("  ⚙️  Провайдер НЕ настроен");
        console.log("  📖  Откройте http://localhost:3000 → нажмите ⚙️");
        console.log();
        console.log("  Рекомендуем DeepSeek — работает из России!");
        console.log("  Ключ: https://platform.deepseek.com/api_keys");
    }
    console.log();
});
