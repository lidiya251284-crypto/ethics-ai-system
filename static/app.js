/* Фикх-Помощник — App Logic
   Works with ChatGPT-style layout */

let allChats = {};
let currentChatId = null;
let providers = [];
let selectedProvider = null;

document.addEventListener("DOMContentLoaded", () => {
    loadChats();
    setupInput();
    renderHistoryList();
    checkStatus();
    if (currentChatId && allChats[currentChatId]?.messages.length > 0) {
        restoreChat(currentChatId);
    } else {
        startNewChat();
    }
});

function setupInput() {
    const inp = document.getElementById("chat-input");
    inp.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inp.addEventListener("input", () => {
        inp.style.height = "auto";
        inp.style.height = Math.min(inp.scrollHeight, 120) + "px";
    });
}

// ── API Status ──────────────────────────────────────────────
async function checkStatus() {
    try {
        const r = await fetch("/api/status");
        const d = await r.json();
        providers = d.providers || [];
        const label = document.getElementById("provider-label");
        if (d.configured) {
            label.textContent = "AI • " + d.providerName;
        } else {
            label.textContent = "AI не настроен";
        }
    } catch (e) {
        document.getElementById("provider-label").textContent = "Сервер недоступен";
    }
}

// ── Setup Modal ───────────────────────────────────────────────
function openSetup() {
    const modal = document.getElementById("setup-modal");
    modal.classList.add("show");
    renderProviders();
}

function closeSetup() {
    document.getElementById("setup-modal").classList.remove("show");
}

function renderProviders() {
    const list = document.getElementById("provider-list");
    list.innerHTML = "";
    for (const p of providers) {
        const btn = document.createElement("button");
        btn.className = "provider-btn" + (selectedProvider === p.id ? " selected" : "");
        btn.innerHTML = `<strong>${p.name}</strong><small>${p.description}</small>`;
        btn.onclick = () => selectProvider(p.id);
        list.appendChild(btn);
    }
}

function selectProvider(id) {
    selectedProvider = id;
    const p = providers.find(x => x.id === id);
    document.getElementById("key-input-area").classList.remove("hidden");
    document.getElementById("key-label").textContent = "API-ключ для " + p.name + ":";
    document.getElementById("setup-link").innerHTML = `Получить ключ: <a href="${p.signupUrl}" target="_blank" style="color:var(--accent)">${p.signupUrl.replace("https://", "")}</a>`;
    renderProviders();
    hideSetupStatus();
}

async function submitSetup() {
    const key = document.getElementById("setup-key-input").value.trim();
    if (!selectedProvider) { showSetupStatus("Выберите провайдер", "#ef4444"); return; }
    if (!key || key.length < 10) { showSetupStatus("Введите ключ", "#ef4444"); return; }

    const btn = document.getElementById("setup-submit-btn");
    btn.disabled = true;
    btn.textContent = "⏳ Проверяю...";

    try {
        const r = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: selectedProvider, key })
        });
        const d = await r.json();
        if (d.status === "ok") {
            showSetupStatus(d.message, "#10b981");
            document.getElementById("provider-label").textContent = "AI • " + d.providerName;
            setTimeout(closeSetup, 1200);
        } else {
            showSetupStatus("✕ " + d.message, "#ef4444");
        }
    } catch (e) {
        showSetupStatus("✕ Ошибка сети", "#ef4444");
    }
    btn.disabled = false;
    btn.textContent = "✅ Проверить и сохранить";
}

function showSetupStatus(msg, color) {
    const el = document.getElementById("setup-status");
    el.classList.remove("hidden");
    el.textContent = msg;
    el.style.color = color;
}
function hideSetupStatus() {
    document.getElementById("setup-status").classList.add("hidden");
}

// ── Storage ───────────────────────────────────────────────────
function loadChats() {
    try { allChats = JSON.parse(localStorage.getItem("fiqh_chats2") || "{}"); } catch (e) { allChats = {}; }
    currentChatId = localStorage.getItem("fiqh_current2") || null;
}
function saveChats() {
    localStorage.setItem("fiqh_chats2", JSON.stringify(allChats));
    localStorage.setItem("fiqh_current2", currentChatId || "");
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Chat Management ─────────────────────────────────────────
function startNewChat() {
    currentChatId = genId();
    allChats[currentChatId] = { title: "Новый чат", messages: [], created: Date.now() };
    saveChats();
    clearChatUI();
    renderHistoryList();
    document.getElementById("chat-input").focus();
    closeSidebarOnMobile();
}

function switchToChat(id) {
    if (!allChats[id]) return;
    currentChatId = id;
    saveChats();
    restoreChat(id);
    renderHistoryList();
    closeSidebarOnMobile();
}

function deleteChat(id, ev) {
    ev.stopPropagation();
    delete allChats[id];
    if (currentChatId === id) { currentChatId = null; startNewChat(); }
    saveChats();
    renderHistoryList();
}

function clearAllHistory() {
    if (!confirm("Удалить все чаты?")) return;
    allChats = {};
    currentChatId = null;
    saveChats();
    startNewChat();
}

function restoreChat(id) {
    currentChatId = id;
    clearChatUI();
    const chat = allChats[id];
    if (!chat) return;
    for (const msg of chat.messages) {
        appendMsgUI(msg.role, msg.text, false);
    }
    scrollToBottom();
}

function clearChatUI() {
    const el = document.getElementById("chat-messages");
    el.innerHTML = `
        <div class="message bot">
            <div class="message-bubble">
                Ассаламу алейкум! 👋<br><br>
                Я — <strong>Фикх-Помощник</strong>. Задайте вопрос по исламскому праву.<br><br>
                <span class="caption">
                    <span class="tag tag-h">Ханафитский</span>
                    <span class="tag tag-m">Маликитский</span>
                    <span class="tag tag-s">Шафиитский</span>
                    <span class="tag tag-b">Ханбалитский</span>
                </span>
            </div>
        </div>`;
}

// ── Sidebar ─────────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}
function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("open");
    }
}

function renderHistoryList() {
    const list = document.getElementById("history-list");
    const sorted = Object.entries(allChats).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
    if (sorted.length === 0) {
        list.innerHTML = '<div class="chat-empty">Нет чатов</div>';
        return;
    }
    list.innerHTML = sorted.map(([id, c]) =>
        `<div class="chat-item${id === currentChatId ? " active" : ""}" onclick="switchToChat('${id}')">
            <span class="chat-item-title">${esc(c.title || "Без названия")}</span>
            <button class="chat-item-delete" onclick="deleteChat('${id}', event)" title="Удалить">✕</button>
        </div>`
    ).join("");
}

// ── Messages ────────────────────────────────────────────────
async function sendMessage() {
    const inp = document.getElementById("chat-input");
    const text = inp.value.trim();
    if (!text) return;
    inp.value = "";
    inp.style.height = "auto";

    addMessage("user", text);

    showTyping();
    const reply = await callBackend(text);
    hideTyping();

    addMessage("bot", reply);
}

function addMessage(role, content) {
    if (!allChats[currentChatId]) return;
    allChats[currentChatId].messages.push({ role, text: content });

    // Update title from first user message
    if (role === "user" && allChats[currentChatId].messages.filter(m => m.role === "user").length === 1) {
        allChats[currentChatId].title = content.substring(0, 40) + (content.length > 40 ? "..." : "");
        renderHistoryList();
    }

    const html = role === "user" ? `<div class="user-text">${esc(content)}</div>` : md2html(content);
    appendMsgUI(role, html, true);
    saveChats();
}

function appendMsgUI(role, html, anim) {
    const el = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message ${role === "user" ? "user" : "bot"}`;
    if (!anim) div.style.animation = "none";
    div.innerHTML = `<div class="message-bubble">${role === "user" && !html.includes("user-text") ? `<div class="user-text">${html}</div>` : html}</div>`;
    el.appendChild(div);
    scrollToBottom();
}

function showTyping() { document.getElementById("typing-indicator").style.display = "block"; scrollToBottom(); }
function hideTyping() { document.getElementById("typing-indicator").style.display = "none"; }
function scrollToBottom() {
    const el = document.getElementById("chat-messages");
    el.scrollTop = el.scrollHeight;
}

// ── Backend ─────────────────────────────────────────────────
async function callBackend(userMessage) {
    try {
        const chat = allChats[currentChatId];
        const history = (chat?.messages || []).slice(-20).map(m => ({ role: m.role, text: m.text }));

        const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage, history })
        });
        const d = await r.json();
        return d.message || "Ошибка";
    } catch (e) {
        return "❌ Ошибка сети: " + e.message;
    }
}

// ── Markdown → HTML ──────────────────────────────────────────
function md2html(text) {
    if (!text) return "";
    let h = text
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^## (.+)$/gm, "<h3>$1</h3>")
        .replace(/^# (.+)$/gm, "<h3>$1</h3>")
        .replace(/^\* (.+)$/gm, "• $1<br>")
        .replace(/^- (.+)$/gm, "• $1<br>")
        .replace(/^\d+\.\s(.+)$/gm, (m, p1, o, s) => {
            const num = s.substring(0, o).split("\n").filter(l => /^\d+\./.test(l)).length + 1;
            return `${num}. ${p1}<br>`;
        })
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
    return h;
}

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
