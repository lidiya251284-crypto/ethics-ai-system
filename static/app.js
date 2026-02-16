/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine v7 (Node.js + Groq AI)
   
   • Отправка через /api/chat (сервер → Groq → Llama 3.3)
   • Сохранение/ввод API-ключа через /api/set-key
   • История чатов в localStorage
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "fiqh_helper_chats";
let currentChatId = null, allChats = {}, isProcessing = false;

// ── Init ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadChats(); setupInput(); renderHistoryList(); checkApiKey();
    if (currentChatId && allChats[currentChatId]?.messages.length > 0) restoreChat(currentChatId);
    else startNewChat();
});

function setupInput() {
    const inp = document.getElementById("chat-input");
    inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 120) + "px"; });
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

async function checkApiKey() {
    try {
        const r = await fetch("/api/status");
        const d = await r.json();
        if (!d.has_key) document.getElementById("api-key-banner").style.display = "block";
    } catch (e) {
        document.getElementById("api-key-banner").style.display = "block";
    }
}

async function saveKey() {
    const input = document.getElementById("api-key-input");
    const status = document.getElementById("key-status");
    const key = input.value.trim();
    if (!key) { status.textContent = "Введите ключ"; status.style.display = "block"; return; }

    status.textContent = "⏳ Сохраняю..."; status.style.display = "block";
    try {
        const r = await fetch("/api/set-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
        const d = await r.json();
        if (d.status === "ok") {
            status.textContent = "✅ Ключ сохранён!"; status.style.color = "#22c55e";
            setTimeout(() => { document.getElementById("api-key-banner").style.display = "none"; }, 1500);
        } else {
            status.textContent = "❌ " + d.message; status.style.color = "#fbbf24";
        }
    } catch (e) { status.textContent = "❌ Ошибка соединения с сервером"; status.style.color = "#ef4444"; }
}

// ── Storage ────────────────────────────────────────────────────
function loadChats() { try { const d = localStorage.getItem(STORAGE_KEY); if (d) { const p = JSON.parse(d); allChats = p.chats || {}; currentChatId = p.currentChatId || null; } } catch (e) { allChats = {}; } }
function saveChats() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats: allChats, currentChatId })); } catch (e) { } }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ── Chat Management ────────────────────────────────────────────
function startNewChat() { const id = genId(); allChats[id] = { id, title: "Новый чат", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; currentChatId = id; saveChats(); clearChatUI(); renderHistoryList(); }
function switchToChat(id) { if (!allChats[id]) return; currentChatId = id; saveChats(); restoreChat(id); renderHistoryList(); toggleHistory(); }
function deleteChat(id, ev) { ev.stopPropagation(); delete allChats[id]; if (id === currentChatId) { const k = Object.keys(allChats); k.length ? (currentChatId = k[k.length - 1], restoreChat(currentChatId)) : startNewChat(); } saveChats(); renderHistoryList(); }
function clearAllHistory() { if (!confirm("Удалить всю историю?")) return; allChats = {}; currentChatId = null; startNewChat(); }
function restoreChat(id) { clearChatUI(); const c = allChats[id]; if (c) c.messages.forEach(m => appendMsgUI(m.role, m.html, false)); scrollToBottom(); }
function clearChatUI() {
    document.getElementById("chat-messages").innerHTML = `
        <div class="message bot-message" style="animation:none"><div class="message-avatar">🤖</div>
        <div class="message-content"><div class="message-text">
            Ассаламу алейкум! 👋<br><br>Я — <strong>Фикх-Помощник</strong> на основе AI.<br>Задайте мне <strong>любой вопрос</strong> по исламскому праву.<br><br>
            <span class="hint-text">
            <span class="madhab-tag madhab-hanafi">Ханафитский</span>
            <span class="madhab-tag madhab-maliki">Маликитский</span>
            <span class="madhab-tag madhab-shafii">Шафиитский</span>
            <span class="madhab-tag madhab-hanbali">Ханбалитский</span></span>
        </div></div></div>`;
}

// ── Sidebar ────────────────────────────────────────────────────
function toggleHistory() { document.getElementById("history-sidebar").classList.toggle("open"); document.getElementById("sidebar-overlay").classList.toggle("open"); }
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
            <button class="history-item-delete" onclick="deleteChat('${c.id}', event)">🗑</button>
        </div>`).join("");
}
function fmtDate(d) { const m = Math.floor((Date.now() - d) / 60000); if (m < 1) return "Только что"; if (m < 60) return `${m} мин.`; const h = Math.floor(m / 60); if (h < 24) return `${h} ч.`; const days = Math.floor(h / 24); if (days < 7) return `${days} дн.`; return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); }

// ── Messages ───────────────────────────────────────────────────
async function sendMessage() {
    if (isProcessing) return;
    const inp = document.getElementById("chat-input");
    const text = inp.value.trim(); if (!text) return;
    inp.value = ""; inp.style.height = "auto";
    addMessage("user", text);
    isProcessing = true; document.getElementById("send-btn").disabled = true; showTyping();

    let response;
    try { response = await callBackend(text); } catch (e) { response = "❌ " + (e.message || "Ошибка соединения"); }

    hideTyping(); addMessage("bot", response);
    isProcessing = false; document.getElementById("send-btn").disabled = false; inp.focus();
}

function addMessage(role, content) {
    const html = role === "user" ? esc(content) : content;
    if (currentChatId && allChats[currentChatId]) {
        const c = allChats[currentChatId]; c.messages.push({ role, html, text: content });
        c.updatedAt = new Date().toISOString();
        if (role === "user" && c.title === "Новый чат") c.title = content.substring(0, 50) + (content.length > 50 ? "…" : "");
        saveChats(); renderHistoryList();
    }
    appendMsgUI(role, html, true);
}
function appendMsgUI(role, html, anim) {
    const c = document.getElementById("chat-messages"); const div = document.createElement("div");
    div.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    if (!anim) div.style.animation = "none";
    div.innerHTML = `<div class="message-avatar">${role === "user" ? "👤" : "🤖"}</div><div class="message-content"><div class="message-text">${html}</div></div>`;
    c.appendChild(div); scrollToBottom();
}
function showTyping() { document.getElementById("typing-indicator").style.display = "flex"; scrollToBottom(); }
function hideTyping() { document.getElementById("typing-indicator").style.display = "none"; }
function scrollToBottom() { const c = document.getElementById("chat-messages"); setTimeout(() => c.scrollTop = c.scrollHeight, 50); }

// ── Backend Call ───────────────────────────────────────────────
async function callBackend(userMessage) {
    const chat = allChats[currentChatId];
    const history = chat ? chat.messages.slice(-20).map(m => ({ role: m.role, text: m.text })) : [];

    const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history, session_id: currentChatId }),
    });
    const data = await resp.json();
    if (data.status === "error") return "⚠️ " + (data.message || "Ошибка сервера");
    return md2html(data.message || "");
}

// ── Markdown → HTML ────────────────────────────────────────────
function md2html(text) {
    let h = text;
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    h = h.replace(/^### (.+)$/gm, '<br><strong>$1</strong>');
    h = h.replace(/^## (.+)$/gm, '<br><strong style="font-size:1.05em">$1</strong>');
    h = h.replace(/^# (.+)$/gm, '<br><strong style="font-size:1.1em">$1</strong>');
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#14b8a6">$1</a>');
    h = h.replace(/^[-*] (.+)$/gm, '• $1');
    h = h.replace(/^\d+\.\s+(.+)$/gm, '• $1');
    h = h.replace(/\**(Ханафитский мазхаб|По ханафитскому мазхабу|Ханафиты)\**:?/gi, '<span class="madhab-tag madhab-hanafi">Ханафитский</span>');
    h = h.replace(/\**(Маликитский мазхаб|По маликитскому мазхабу|Маликиты)\**:?/gi, '<span class="madhab-tag madhab-maliki">Маликитский</span>');
    h = h.replace(/\**(Шафиитский мазхаб|По шафиитскому мазхабу|Шафииты)\**:?/gi, '<span class="madhab-tag madhab-shafii">Шафиитский</span>');
    h = h.replace(/\**(Ханбалитский мазхаб|По ханбалитскому мазхабу|Ханбалиты)\**:?/gi, '<span class="madhab-tag madhab-hanbali">Ханбалитский</span>');
    h = h.replace(/\n\n/g, '<br><br>'); h = h.replace(/\n/g, '<br>');
    return h;
}

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
