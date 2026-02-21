/* Фикх-Помощник — App Logic (Lovable UI) */

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
        inp.style.height = Math.min(inp.scrollHeight, 160) + "px";
    });
}

// ── API Status ──────────────────────────────────────────────
async function checkStatus() {
    try {
        const r = await fetch("/api/status");
        const d = await r.json();
        providers = d.providers || [];
        const label = document.getElementById("provider-label");
        const dot = document.querySelector(".status-dot");

        if (d.configured) {
            label.textContent = d.providerName;
            dot.style.background = "var(--accent)";
            dot.style.boxShadow = "0 0 8px var(--accent)";
        } else {
            label.textContent = "AI не настроен";
            dot.style.background = "#EF4444";
            dot.style.boxShadow = "0 0 8px #EF4444";
        }
    } catch (e) {
        document.getElementById("provider-label").textContent = "Сервер офлайн";
    }
}

// ── Setup Modal ───────────────────────────────────────────────
function openSetup() {
    document.getElementById("setup-modal").classList.add("show");
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
        btn.innerHTML = `<strong>${p.name}</strong><br><small>${p.description}</small>`;
        btn.onclick = () => selectProvider(p.id);
        list.appendChild(btn);
    }
}

function selectProvider(id) {
    selectedProvider = id;
    const p = providers.find(x => x.id === id);
    document.getElementById("key-input-area").classList.remove("hidden");
    document.getElementById("key-label").textContent = "API-ключ (" + p.name + "):";
    document.getElementById("setup-link").innerHTML = `Ключ: <a href="${p.signupUrl}" target="_blank" style="color:var(--accent)">${p.signupUrl.replace("https://", "")}</a>`;
    renderProviders();
}

async function submitSetup() {
    const key = document.getElementById("setup-key-input").value.trim();
    if (!selectedProvider) return;
    if (!key || key.length < 10) return;

    const btn = document.getElementById("setup-submit-btn");
    btn.disabled = true;
    btn.textContent = "Проверка...";

    try {
        const r = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: selectedProvider, key })
        });
        const d = await r.json();
        if (d.status === "ok") {
            showSetupStatus("Успешно!", "var(--accent)");
            checkStatus();
            setTimeout(closeSetup, 1000);
        } else {
            showSetupStatus("Ошибка: " + d.message, "#EF4444");
        }
    } catch (e) {
        showSetupStatus("Ошибка сети", "#EF4444");
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

// ── Storage ───────────────────────────────────────────────────
function loadChats() {
    try { allChats = JSON.parse(localStorage.getItem("fiqh_chats_v2") || "{}"); } catch (e) { allChats = {}; }
    currentChatId = localStorage.getItem("fiqh_current_v2");
}
function saveChats() {
    localStorage.setItem("fiqh_chats_v2", JSON.stringify(allChats));
    localStorage.setItem("fiqh_current_v2", currentChatId || "");
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Chat Management ─────────────────────────────────────────
function startNewChat() {
    currentChatId = genId();
    allChats[currentChatId] = { title: "Новый чат", messages: [], created: Date.now() };
    saveChats();
    clearChatUI();
    renderHistoryList();
    updateWelcomeVisibility(true);
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

function restoreChat(id) {
    currentChatId = id;
    clearChatUI();
    const chat = allChats[id];
    if (!chat || chat.messages.length === 0) {
        updateWelcomeVisibility(true);
        return;
    }
    updateWelcomeVisibility(false);
    for (const msg of chat.messages) {
        appendMsgUI(msg.role, msg.text, false);
    }
    scrollToBottom();
}

function clearChatUI() {
    document.getElementById("chat-messages").innerHTML = "";
}

function updateWelcomeVisibility(show) {
    document.getElementById("welcome-screen").style.display = show ? "flex" : "none";
}

// ── Sidebar ─────────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebar-overlay").classList.toggle("show");
}
function closeSidebarOnMobile() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("show");
}

function renderHistoryList() {
    const list = document.getElementById("history-list");
    const sorted = Object.entries(allChats).sort((a, b) => (b[1].created || 0) - (a[1].created || 0));

    if (sorted.length === 0) {
        list.innerHTML = '<div class="chat-empty">Чатов пока нет</div>';
        return;
    }

    list.innerHTML = sorted.map(([id, c]) =>
        `<div class="chat-item${id === currentChatId ? " active" : ""}" onclick="switchToChat('${id}')">
            <span class="chat-item-title">${esc(c.title || "Пустой чат")}</span>
            <button class="chat-item-delete" onclick="deleteChat('${id}', event)">✕</button>
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
    document.getElementById("char-counter").textContent = "0/2000";

    if (allChats[currentChatId]?.messages.length === 0) {
        updateWelcomeVisibility(false);
    }

    addMessage("user", text);
    showTyping();

    const reply = await callBackend(text);
    hideTyping();

    addMessage("bot", reply);
}

function addMessage(role, content) {
    if (!allChats[currentChatId]) return;
    allChats[currentChatId].messages.push({ role, text: content });

    if (role === "user" && allChats[currentChatId].messages.filter(m => m.role === "user").length === 1) {
        allChats[currentChatId].title = content.substring(0, 30) + (content.length > 30 ? "..." : "");
        renderHistoryList();
    }

    appendMsgUI(role, role === "user" ? `<div class="user-text">${esc(content)}</div>` : md2html(content), true);
    saveChats();
}

function appendMsgUI(role, html, anim) {
    const el = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = `message ${role}`;
    if (!anim) div.style.animation = "none";
    div.innerHTML = `<div class="message-bubble">${html}</div>`;
    el.appendChild(div);
    scrollToBottom();
}

function showTyping() { document.getElementById("typing-indicator").style.display = "block"; scrollToBottom(); }
function hideTyping() { document.getElementById("typing-indicator").style.display = "none"; }
function scrollToBottom() {
    const el = document.querySelector(".chat-viewport");
    el.scrollTop = el.scrollHeight;
}

// ── Backend Call ───────────────────────────────────────────────
async function callBackend(userMessage) {
    try {
        const chat = allChats[currentChatId];
        const history = (chat?.messages || []).slice(-10).map(m => ({ role: m.role, text: m.text }));

        const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage, history })
        });
        const d = await r.json();
        return d.message || "Ошибка получения ответа";
    } catch (e) {
        return "❌ Ошибка соединения";
    }
}

// ── Markdown → HTML ────────────────────────────────────────────
function md2html(text) {
    if (!text) return "";
    return text
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^## (.+)$/gm, "<h3>$1</h3>")
        .replace(/^# (.+)$/gm, "<h3>$1</h3>")
        .replace(/^\* (.+)$/gm, "• $1<br>")
        .replace(/^- (.+)$/gm, "• $1<br>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
}

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
