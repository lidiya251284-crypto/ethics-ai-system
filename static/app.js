/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine v4 (Google Gemini AI)
   
   • gemini-1.5-flash → gemini-2.0-flash-lite → gemini-2.0-flash
   • Автоматический fallback при ошибке квоты
   • Контекст беседы (последние 20 сообщений)
   • История чатов в localStorage
   ═══════════════════════════════════════════════════════════════ */

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY = "fiqh_helper_chats";
const API_KEY_STORAGE = "fiqh_helper_api_key";
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

6. Будь объективен — не навязывай один мазхаб, но можешь указать какое мнение более распространённое.

7. Форматируй ответ чистым текстом с **жирным** выделением, списками через • и подзаголовками.

8. В конце ответа давай 1-2 ссылки на авторитетные источники: islamqa.info, islamweb.net, azan.ru, fatwaonline.net`;

// ── State ──────────────────────────────────────────────────────
let currentChatId = null;
let allChats = {};
let isProcessing = false;
let apiKey = "";

// ── Initialization ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    apiKey = localStorage.getItem(API_KEY_STORAGE) || "";
    loadChats();
    setupInput();
    renderHistoryList();
    updateApiBanner();

    if (currentChatId && allChats[currentChatId] && allChats[currentChatId].messages.length > 0) {
        restoreChat(currentChatId);
    } else {
        startNewChat();
    }
});

function setupInput() {
    const input = document.getElementById("chat-input");
    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// ── API Key ────────────────────────────────────────────────────
function openSettings() {
    const overlay = document.getElementById("settings-overlay");
    const input = document.getElementById("api-key-input");
    overlay.classList.add("open");
    if (apiKey) input.value = apiKey;
    document.getElementById("key-status").textContent = "";
}

function closeSettings() {
    document.getElementById("settings-overlay").classList.remove("open");
}

function toggleKeyVisibility() {
    const inp = document.getElementById("api-key-input");
    inp.type = inp.type === "password" ? "text" : "password";
}

async function saveApiKey() {
    const input = document.getElementById("api-key-input");
    const status = document.getElementById("key-status");
    const key = input.value.trim();

    if (!key) { status.className = "key-status error"; status.textContent = "❌ Введите API-ключ"; return; }

    status.className = "key-status"; status.textContent = "⏳ Проверяю ключ...";

    // Test each model until one works
    for (const model of GEMINI_MODELS) {
        try {
            const resp = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Ответь одним словом: работает" }] }] }),
            });

            if (resp.ok) {
                apiKey = key;
                localStorage.setItem(API_KEY_STORAGE, key);
                status.className = "key-status success";
                status.textContent = `✅ Ключ работает! (модель: ${model})`;
                updateApiBanner();
                setTimeout(closeSettings, 1500);
                return;
            }

            const err = await resp.json();
            const errMsg = err.error?.message || "";
            if (errMsg.toLowerCase().includes("quota") || resp.status === 429) {
                console.warn(`${model}: quota exceeded, trying next...`);
                continue;
            }
            if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
                status.className = "key-status error";
                status.textContent = "❌ Неверный ключ. Проверьте и попробуйте снова.";
                return;
            }
        } catch (e) {
            status.className = "key-status error";
            status.textContent = "❌ Ошибка сети. Проверьте интернет.";
            return;
        }
    }

    // All models had quota issues — save anyway and inform
    apiKey = key;
    localStorage.setItem(API_KEY_STORAGE, key);
    status.className = "key-status error";
    status.textContent = "⚠️ Ключ принят, но лимит исчерпан. Создайте новый ключ в новом проекте на aistudio.google.com/apikey";
    updateApiBanner();
}

function updateApiBanner() {
    const banner = document.getElementById("api-banner");
    banner.classList.toggle("hidden", !!apiKey);
}

// ── LocalStorage ───────────────────────────────────────────────
function loadChats() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) { const p = JSON.parse(data); allChats = p.chats || {}; currentChatId = p.currentChatId || null; }
    } catch (e) { allChats = {}; }
}
function saveChats() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats: allChats, currentChatId })); } catch (e) { }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ── Chat Management ────────────────────────────────────────────
function startNewChat() {
    const id = genId();
    allChats[id] = { id, title: "Новый чат", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    currentChatId = id; saveChats(); clearChatUI(); renderHistoryList();
}
function switchToChat(chatId) {
    if (!allChats[chatId]) return;
    currentChatId = chatId; saveChats(); restoreChat(chatId); renderHistoryList(); toggleHistory();
}
function deleteChat(chatId, event) {
    event.stopPropagation(); delete allChats[chatId];
    if (chatId === currentChatId) { const k = Object.keys(allChats); k.length > 0 ? (currentChatId = k[k.length - 1], restoreChat(currentChatId)) : startNewChat(); }
    saveChats(); renderHistoryList();
}
function clearAllHistory() {
    if (!confirm("Удалить всю историю чатов?")) return;
    allChats = {}; currentChatId = null; startNewChat();
}
function restoreChat(chatId) {
    clearChatUI(); const chat = allChats[chatId];
    if (!chat) return; chat.messages.forEach(m => appendMessageToUI(m.role, m.html, false)); scrollToBottom();
}
function clearChatUI() {
    document.getElementById("chat-messages").innerHTML = `
        <div class="message bot-message" style="animation:none">
            <div class="message-avatar">🤖</div>
            <div class="message-content"><div class="message-text">
                Ассаламу алейкум! 👋<br><br>
                Задайте мне <strong>любой вопрос</strong> по исламскому праву.<br><br>
                <span class="hint-text">
                <span class="madhab-tag madhab-hanafi">Ханафитский</span>
                <span class="madhab-tag madhab-maliki">Маликитский</span>
                <span class="madhab-tag madhab-shafii">Шафиитский</span>
                <span class="madhab-tag madhab-hanbali">Ханбалитский</span>
                </span>
            </div></div>
        </div>`;
}

// ── Sidebar ────────────────────────────────────────────────────
function toggleHistory() {
    document.getElementById("history-sidebar").classList.toggle("open");
    document.getElementById("sidebar-overlay").classList.toggle("open");
}
function renderHistoryList() {
    const list = document.getElementById("history-list");
    const sorted = Object.values(allChats).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (!sorted.length) { list.innerHTML = '<div class="history-empty">История пуста</div>'; return; }
    list.innerHTML = sorted.map(c => `
        <div class="history-item ${c.id === currentChatId ? 'active' : ''}" onclick="switchToChat('${c.id}')">
            <div class="history-item-icon">💬</div>
            <div class="history-item-text">
                <div class="history-item-title">${esc(c.title)}</div>
                <div class="history-item-date">${fmtDate(new Date(c.updatedAt))}</div>
            </div>
            <button class="history-item-delete" onclick="deleteChat('${c.id}', event)" title="Удалить">🗑</button>
        </div>`).join("");
}
function fmtDate(d) {
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return "Только что"; if (m < 60) return `${m} мин. назад`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} ч. назад`;
    const days = Math.floor(h / 24); if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Messages ───────────────────────────────────────────────────
async function sendMessage() {
    if (isProcessing) return;
    const input = document.getElementById("chat-input");
    const text = input.value.trim(); if (!text) return;
    input.value = ""; input.style.height = "auto";
    addMessage("user", text);

    isProcessing = true;
    document.getElementById("send-btn").disabled = true;
    showTyping();

    let response;
    if (!apiKey) {
        response = '🔑 Нужен API-ключ.<br>Нажмите ⚙️ → вставьте ключ с <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#14b8a6">aistudio.google.com/apikey</a>';
    } else {
        response = await callGemini(text);
    }

    hideTyping();
    addMessage("bot", response);
    isProcessing = false;
    document.getElementById("send-btn").disabled = false;
    input.focus();
}

function addMessage(role, content) {
    const html = role === "user" ? esc(content) : content;
    if (currentChatId && allChats[currentChatId]) {
        const chat = allChats[currentChatId];
        chat.messages.push({ role, html, text: content });
        chat.updatedAt = new Date().toISOString();
        if (role === "user" && chat.title === "Новый чат")
            chat.title = content.substring(0, 50) + (content.length > 50 ? "…" : "");
        saveChats(); renderHistoryList();
    }
    appendMessageToUI(role, html, true);
}

function appendMessageToUI(role, html, animate) {
    const c = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    if (!animate) div.style.animation = "none";
    div.innerHTML = `<div class="message-avatar">${role === "user" ? "👤" : "🤖"}</div>
        <div class="message-content"><div class="message-text">${html}</div></div>`;
    c.appendChild(div); scrollToBottom();
}

function showTyping() { document.getElementById("typing-indicator").style.display = "flex"; scrollToBottom(); }
function hideTyping() { document.getElementById("typing-indicator").style.display = "none"; }
function scrollToBottom() { const c = document.getElementById("chat-messages"); setTimeout(() => c.scrollTop = c.scrollHeight, 50); }

// ── Gemini API (multi-model fallback) ──────────────────────────
async function callGemini(userMessage) {
    const chat = allChats[currentChatId];
    const history = [];
    const recent = chat.messages.slice(-20);
    for (const msg of recent) {
        history.push({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.text }] });
    }
    history.push({ role: "user", parts: [{ text: userMessage }] });

    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history,
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 2048 },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
    };

    for (const model of GEMINI_MODELS) {
        try {
            const resp = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const err = await resp.json();
                const msg = err.error?.message || "";
                if (resp.status === 429 || msg.toLowerCase().includes("quota")) {
                    console.warn(`${model}: quota, trying next`); continue;
                }
                if (resp.status === 401 || resp.status === 403) {
                    return "🔑 Проблема с ключом. Нажмите ⚙️ и проверьте API-ключ.";
                }
                console.warn(`${model}: ${msg}`); continue;
            }

            const data = await resp.json();
            const cand = data.candidates?.[0];
            if (!cand?.content?.parts?.[0]?.text) {
                if (cand?.finishReason === "SAFETY") return "⚠️ Ответ заблокирован. Переформулируйте вопрос.";
                continue;
            }
            return md2html(cand.content.parts[0].text);
        } catch (e) {
            if (e.message?.includes("Failed to fetch")) return "🌐 Нет интернета.";
            continue;
        }
    }

    return `⏳ Лимит всех моделей исчерпан. Создайте новый ключ:<br>
    1. Откройте <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#14b8a6">aistudio.google.com/apikey</a><br>
    2. Нажмите «Create API key in <strong>new project</strong>»<br>
    3. Скопируйте ключ → нажмите ⚙️ → вставьте`;
}

// ── Markdown → HTML ────────────────────────────────────────────
function md2html(text) {
    let h = text;
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    h = h.replace(/^#### (.+)$/gm, '<strong style="font-size:0.9em">$1</strong>');
    h = h.replace(/^### (.+)$/gm, '<br><strong>$1</strong>');
    h = h.replace(/^## (.+)$/gm, '<br><strong style="font-size:1.05em">$1</strong>');
    h = h.replace(/^# (.+)$/gm, '<br><strong style="font-size:1.1em">$1</strong>');
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#14b8a6">$1</a>');
    h = h.replace(/^[-*] (.+)$/gm, '• $1');
    h = h.replace(/^\d+\.\s+(.+)$/gm, '• $1');
    // Madhab color tags
    h = h.replace(/\**(Ханафитский мазхаб|По ханафитскому мазхабу|Ханафиты)\**:?/gi, '<span class="madhab-tag madhab-hanafi">Ханафитский</span>');
    h = h.replace(/\**(Маликитский мазхаб|По маликитскому мазхабу|Маликиты)\**:?/gi, '<span class="madhab-tag madhab-maliki">Маликитский</span>');
    h = h.replace(/\**(Шафиитский мазхаб|По шафиитскому мазхабу|Шафииты)\**:?/gi, '<span class="madhab-tag madhab-shafii">Шафиитский</span>');
    h = h.replace(/\**(Ханбалитский мазхаб|По ханбалитскому мазхабу|Ханбалиты)\**:?/gi, '<span class="madhab-tag madhab-hanbali">Ханбалитский</span>');
    h = h.replace(/\n\n/g, '<br><br>');
    h = h.replace(/\n/g, '<br>');
    return h;
}

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
