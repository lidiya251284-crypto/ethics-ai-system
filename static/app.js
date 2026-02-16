/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine v4 (Puter.js — Free AI)
   
   Архитектура:
   • Puter.js — бесплатный AI без API-ключа
   • puter.ai.chat() — обращение к GPT-4o / Claude / Gemini
   • Контекст беседы (последние сообщения)
   • История чатов в localStorage
   ═══════════════════════════════════════════════════════════════ */

// ── Constants ──────────────────────────────────────────────────
const STORAGE_KEY = "fiqh_helper_chats";

// System instruction for the AI
const SYSTEM_PROMPT = `Ты — учёный-факих (специалист по исламскому праву / фикху). Твоя задача — отвечать на вопросы пользователей по исламскому праву (фикху).

ПРАВИЛА ОТВЕТОВ:
1. Отвечай ТОЛЬКО на вопросы, связанные с исламским правом (фикхом), поклонением, морально-этическими нормами ислама. На нерелигиозные вопросы вежливо отклоняй.

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

5. Если вопрос слишком общий — задай уточняющие вопросы.

6. Отвечай на русском языке. Арабские термины давай с переводом.

7. Будь объективен — не навязывай один мазхаб, но можешь указать какое мнение более распространённое.

8. Форматируй ответ используя Markdown:
   - **текст** для выделения
   - Списки через - или •
   - ### для подзаголовков
   - Для каждого мазхаба выделяй: **Ханафитский мазхаб:** текст

9. В конце ответа давай 1-2 ссылки на авторитетные источники.
   Используй реальные сайты: islamqa.info, islamweb.net, azan.ru, fatwaonline.net`;

// ── State ──────────────────────────────────────────────────────
let currentChatId = null;
let allChats = {};
let isProcessing = false;

// ── Initialization ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadChats();
    setupInput();
    renderHistoryList();

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

// ── LocalStorage ───────────────────────────────────────────────
function loadChats() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            allChats = parsed.chats || {};
            currentChatId = parsed.currentChatId || null;
        }
    } catch (e) { allChats = {}; }
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats: allChats, currentChatId }));
    } catch (e) { console.error("Save failed:", e); }
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ── Chat Management ────────────────────────────────────────────
function startNewChat() {
    const id = genId();
    allChats[id] = {
        id, title: "Новый чат", messages: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    currentChatId = id;
    saveChats();
    clearChatUI();
    renderHistoryList();
}

function switchToChat(chatId) {
    if (!allChats[chatId]) return;
    currentChatId = chatId;
    saveChats();
    restoreChat(chatId);
    renderHistoryList();
    toggleHistory();
}

function deleteChat(chatId, event) {
    event.stopPropagation();
    delete allChats[chatId];
    if (chatId === currentChatId) {
        const keys = Object.keys(allChats);
        keys.length > 0 ? (currentChatId = keys[keys.length - 1], restoreChat(currentChatId)) : startNewChat();
    }
    saveChats();
    renderHistoryList();
}

function clearAllHistory() {
    if (!confirm("Удалить всю историю чатов?")) return;
    allChats = {}; currentChatId = null;
    startNewChat();
}

function restoreChat(chatId) {
    clearChatUI();
    const chat = allChats[chatId];
    if (!chat) return;
    chat.messages.forEach(m => appendMessageToUI(m.role, m.html, false));
    scrollToBottom();
}

function clearChatUI() {
    document.getElementById("chat-messages").innerHTML = `
        <div class="message bot-message" style="animation:none">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text">
                    Ассаламу алейкум! 👋<br><br>
                    Задайте мне <strong>любой вопрос</strong> по исламскому праву, и я дам ответ с указанием мнений четырёх мазхабов.<br><br>
                    <span class="hint-text">
                    <span class="madhab-tag madhab-hanafi">Ханафитский</span>
                    <span class="madhab-tag madhab-maliki">Маликитский</span>
                    <span class="madhab-tag madhab-shafii">Шафиитский</span>
                    <span class="madhab-tag madhab-hanbali">Ханбалитский</span>
                    </span>
                </div>
            </div>
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
                <div class="history-item-title">${escapeHtml(c.title)}</div>
                <div class="history-item-date">${formatDate(new Date(c.updatedAt))}</div>
            </div>
            <button class="history-item-delete" onclick="deleteChat('${c.id}', event)" title="Удалить">🗑</button>
        </div>`).join("");
}

function formatDate(d) {
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return "Только что";
    if (m < 60) return `${m} мин. назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч. назад`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Message Handling ───────────────────────────────────────────
async function sendMessage() {
    if (isProcessing) return;
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    addMessage("user", text);

    isProcessing = true;
    document.getElementById("send-btn").disabled = true;
    showTyping();

    let response;
    try {
        response = await callAI(text);
    } catch (e) {
        console.error("AI error:", e);
        response = "❌ Ошибка: " + escapeHtml(e.message || "Не удалось получить ответ. Попробуйте ещё раз.");
    }

    hideTyping();
    addMessage("bot", response);

    isProcessing = false;
    document.getElementById("send-btn").disabled = false;
    input.focus();
}

function addMessage(role, content) {
    const html = role === "user" ? escapeHtml(content) : content;

    if (currentChatId && allChats[currentChatId]) {
        const chat = allChats[currentChatId];
        chat.messages.push({ role, html, text: content });
        chat.updatedAt = new Date().toISOString();
        if (role === "user" && chat.title === "Новый чат") {
            chat.title = content.substring(0, 50) + (content.length > 50 ? "…" : "");
        }
        saveChats();
        renderHistoryList();
    }

    appendMessageToUI(role, html, true);
}

function appendMessageToUI(role, html, animate) {
    const c = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    if (!animate) div.style.animation = "none";
    div.innerHTML = `
        <div class="message-avatar">${role === "user" ? "👤" : "🤖"}</div>
        <div class="message-content"><div class="message-text">${html}</div></div>`;
    c.appendChild(div);
    scrollToBottom();
}

function showTyping() { document.getElementById("typing-indicator").style.display = "flex"; scrollToBottom(); }
function hideTyping() { document.getElementById("typing-indicator").style.display = "none"; }
function scrollToBottom() {
    const c = document.getElementById("chat-messages");
    setTimeout(() => { c.scrollTop = c.scrollHeight; }, 50);
}

// ── AI Call via Puter.js ───────────────────────────────────────
async function callAI(userMessage) {
    // Build conversation history for context
    const chat = allChats[currentChatId];
    const messages = [];

    // Add system prompt
    messages.push({ role: "system", content: SYSTEM_PROMPT });

    // Add recent messages for context (last 10 pairs max)
    const recent = chat.messages.slice(-20);
    for (const msg of recent) {
        messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.text
        });
    }

    // Add current message
    messages.push({ role: "user", content: userMessage });

    // Call Puter.js AI
    const response = await puter.ai.chat(messages, {
        model: "gpt-4o-mini"
    });

    // Extract text from response
    let text = "";
    if (typeof response === "string") {
        text = response;
    } else if (response?.message?.content) {
        text = response.message.content;
    } else if (response?.text) {
        text = response.text;
    } else {
        text = JSON.stringify(response);
    }

    // Convert markdown to HTML
    return convertMarkdownToHtml(text);
}

// ── Markdown → HTML Converter ──────────────────────────────────
function convertMarkdownToHtml(text) {
    let html = text;

    // Code blocks (preserve them)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Headers
    html = html.replace(/^#### (.+)$/gm, '<strong style="font-size:0.9em">$1</strong>');
    html = html.replace(/^### (.+)$/gm, '<br><strong>$1</strong>');
    html = html.replace(/^## (.+)$/gm, '<br><strong style="font-size:1.05em">$1</strong>');
    html = html.replace(/^# (.+)$/gm, '<br><strong style="font-size:1.1em">$1</strong>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#14b8a6">$1</a>');

    // Bullet and numbered lists
    html = html.replace(/^[-*] (.+)$/gm, '• $1');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '• $1');

    // Detect madhab mentions and add color tags
    html = html.replace(/\**(Ханафитский мазхаб|По ханафитскому мазхабу|Ханафиты)\**:?/gi,
        '<span class="madhab-tag madhab-hanafi">Ханафитский</span>');
    html = html.replace(/\**(Маликитский мазхаб|По маликитскому мазхабу|Маликиты)\**:?/gi,
        '<span class="madhab-tag madhab-maliki">Маликитский</span>');
    html = html.replace(/\**(Шафиитский мазхаб|По шафиитскому мазхабу|Шафииты)\**:?/gi,
        '<span class="madhab-tag madhab-shafii">Шафиитский</span>');
    html = html.replace(/\**(Ханбалитский мазхаб|По ханбалитскому мазхабу|Ханбалиты)\**:?/gi,
        '<span class="madhab-tag madhab-hanbali">Ханбалитский</span>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ── Helpers ─────────────────────────────────────────────────────
function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
}
