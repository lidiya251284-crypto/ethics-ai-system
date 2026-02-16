/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine v9 (Multi-Provider AI)
   
   DeepSeek / Groq / Mistral — выбор в настройках ⚙️
   История чатов в localStorage
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "fiqh_helper_chats";
let currentChatId = null, allChats = {}, isProcessing = false;
let selectedProvider = null, providers = [];

// ── Init ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadChats(); setupInput(); renderHistoryList(); checkStatus();
    if (currentChatId && allChats[currentChatId]?.messages.length > 0) restoreChat(currentChatId);
    else startNewChat();
});

function setupInput() {
    const inp = document.getElementById("chat-input");
    inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 120) + "px"; });
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

async function checkStatus() {
    try {
        const r = await fetch("/api/status");
        const d = await r.json();
        providers = d.providers || [];
        if (d.configured) {
            document.getElementById("header-subtitle").textContent = `AI • ${d.providerName}`;
        } else {
            openSetup();
        }
    } catch (e) {
        console.error("Status check failed:", e);
    }
}

// ── Setup Modal ────────────────────────────────────────────────
function openSetup() {
    const modal = document.getElementById("setup-modal");
    modal.style.display = "flex";
    renderProviders();
}

function closeSetup() {
    document.getElementById("setup-modal").style.display = "none";
}

function renderProviders() {
    const list = document.getElementById("provider-list");
    list.innerHTML = providers.map(p => `
        <button onclick="selectProvider('${p.id}')" 
            class="provider-btn ${selectedProvider === p.id ? 'selected' : ''}"
            style="display:flex; align-items:center; gap:10px; padding:12px; border-radius:10px; 
                   border:2px solid ${selectedProvider === p.id ? '#14b8a6' : 'rgba(255,255,255,0.1)'}; 
                   background:${selectedProvider === p.id ? 'rgba(20,184,166,0.1)' : 'rgba(255,255,255,0.03)'}; 
                   color:white; cursor:pointer; text-align:left; transition:all 0.2s;">
            <div>
                <div style="font-weight:600; font-size:0.95em;">${p.name}</div>
                <div style="font-size:0.8em; opacity:0.7; margin-top:2px;">${p.description}</div>
            </div>
        </button>
    `).join("");
}

function selectProvider(id) {
    selectedProvider = id;
    renderProviders();
    const p = providers.find(x => x.id === id);
    if (p) {
        const area = document.getElementById("key-input-area");
        area.style.display = "block";
        document.getElementById("key-label").textContent = `API-ключ для ${p.name}:`;
        document.getElementById("setup-link").innerHTML = `Получить ключ: <a href="${p.signupUrl}" target="_blank" style="color:#14b8a6; text-decoration:underline">${p.signupUrl.replace('https://', '')}</a>`;
        document.getElementById("setup-key-input").value = "";
        document.getElementById("setup-key-input").focus();
        hideSetupStatus();
    }
}

async function submitSetup() {
    const key = document.getElementById("setup-key-input").value.trim();
    if (!key) { showSetupStatus("Введите ключ", "#fbbf24"); return; }
    if (!selectedProvider) { showSetupStatus("Выберите провайдер", "#fbbf24"); return; }

    showSetupStatus("⏳ Проверяю ключ...", "#94a3b8");
    document.getElementById("setup-submit-btn").disabled = true;

    try {
        const r = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: selectedProvider, key })
        });
        const d = await r.json();
        if (d.status === "ok") {
            showSetupStatus("✅ " + d.message, "#22c55e");
            document.getElementById("header-subtitle").textContent = `AI • ${d.providerName}`;
            setTimeout(closeSetup, 1500);
        } else {
            showSetupStatus("❌ " + d.message, "#ef4444");
        }
    } catch (e) {
        showSetupStatus("❌ Ошибка соединения с сервером", "#ef4444");
    }
    document.getElementById("setup-submit-btn").disabled = false;
}

function showSetupStatus(msg, color) { const s = document.getElementById("setup-status"); s.textContent = msg; s.style.color = color; s.style.display = "block"; }
function hideSetupStatus() { document.getElementById("setup-status").style.display = "none"; }

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
            Ассаламу алейкум! 👋<br><br>Задайте <strong>любой вопрос</strong> по исламскому праву.<br><br>
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
        body: JSON.stringify({ message: userMessage, history }),
    });
    const data = await resp.json();
    if (data.status === "error") return "⚠️ " + (data.message || "Ошибка");
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
