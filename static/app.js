/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine v6 (Offline — Smart Match)
   
   • Нет API, нет сервера — всё работает из файла
   • Нечёткий поиск по ключевым словам + морфология
   • 28+ вопросов с мнениями 4 мазхабов и далилями
   • История чатов в localStorage
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "fiqh_helper_chats";
let currentChatId = null, allChats = {}, isProcessing = false;

// ── Init ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadChats(); setupInput(); renderHistoryList();
    if (currentChatId && allChats[currentChatId]?.messages.length > 0) restoreChat(currentChatId);
    else startNewChat();
});

function setupInput() {
    const inp = document.getElementById("chat-input");
    inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 120) + "px"; });
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
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
            Ассаламу алейкум! 👋<br><br>Задайте <strong>любой вопрос</strong> по фикху.<br><br>
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
    isProcessing = true; document.getElementById("send-btn").disabled = true;
    showTyping();

    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

    const response = findAnswer(text);
    hideTyping();
    addMessage("bot", response);
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

// ── Smart Matching Engine ──────────────────────────────────────
const STEMS = {
    "молитв": "намаз", "молить": "намаз", "салят": "намаз", "салат": "намаз", "намаз": "намаз",
    "омовен": "вуду", "абдест": "вуду", "тахар": "вуду", "вуду": "вуду", "вуз": "вуду",
    "пост": "пост", "ураз": "пост", "саум": "пост", "сухур": "пост", "ифтар": "пост", "рамадан": "пост",
    "развод": "развод", "талак": "развод", "разводит": "развод", "хульг": "развод",
    "муж": "муж", "жен": "жена", "жена": "жена", "содержа": "нафака", "содержит": "нафака", "нафак": "нафака", "работ": "работа",
    "закят": "закят", "милостын": "закят", "нисаб": "закят",
    "хиджаб": "хиджаб", "покрыти": "хиджаб", "никаб": "хиджаб", "плат": "хиджаб", "аурат": "хиджаб",
    "процент": "риба", "кредит": "риба", "ипотек": "риба", "банк": "риба", "риба": "риба", "ростовщ": "риба",
    "гусль": "гусль", "большо": "гусль", "полно": "гусль", "джанаб": "гусль", "купан": "гусль",
    "никах": "никах", "брак": "никах", "свадьб": "никах", "женить": "никах", "замуж": "никах", "махр": "никах",
    "халяль": "халяль", "харам": "халяль", "свинин": "халяль", "еда": "халяль", "мяс": "халяль", "алкоголь": "халяль",
    "таяммум": "таяммум", "песок": "таяммум", "сухо": "таяммум",
    "пропущен": "каза", "каза": "каза", "возмещен": "каза",
    "беременн": "беременность", "кормящ": "беременность",
    "музык": "музыка", "песн": "музыка", "нашид": "музыка", "кальян": "курение",
    "путник": "сафар", "путешеств": "сафар", "сафар": "сафар", "сокращен": "сафар",
    "похорон": "джаназа", "джаназа": "джаназа", "мёртв": "джаназа", "умер": "джаназа", "смерт": "джаназа",
    "сглаз": "рукъя", "порч": "рукъя", "джинн": "рукъя", "рукъя": "рукъя", "колдов": "рукъя", "сихр": "рукъя",
    "борода": "борода", "брить": "борода", "бритв": "борода",
    "курени": "курение", "курить": "курение", "сигарет": "курение", "вейп": "курение", "табак": "курение",
    "фото": "фото", "фотограф": "фото", "изображен": "фото", "рисова": "фото", "рисун": "фото",
    "хадж": "хадж", "умр": "хадж", "мекк": "хадж", "кааб": "хадж", "паломнич": "хадж",
    "истихар": "истихара", "выбор": "истихара",
    "собак": "животные", "кошк": "животные", "животн": "животные",
    "суджуд": "суджуд", "сахв": "суджуд", "ошибк": "суджуд", "забыл": "суджуд",
    "дуа": "дуа", "мольб": "дуа", "просить": "дуа",
    "приветств": "приветствие", "салям": "приветствие", "салам": "приветствие", "алейкум": "приветствие", "привет": "приветствие", "здравств": "приветствие",
    "месячн": "месячные", "менструац": "месячные", "хайд": "месячные",
};

// Build topic → DB index mapping
const TOPIC_MAP = {};
FIQH_DB.forEach((entry, idx) => {
    entry.keys.forEach(k => {
        const topic = k.toLowerCase();
        if (!TOPIC_MAP[topic]) TOPIC_MAP[topic] = [];
        TOPIC_MAP[topic].push(idx);
    });
});

function normalize(text) {
    return text.toLowerCase().replace(/[?!.,;:\-—–«»"'()]/g, " ").replace(/\s+/g, " ").trim();
}

function findAnswer(query) {
    const norm = normalize(query);
    const words = norm.split(" ").filter(w => w.length > 2);

    if (words.length === 0) return "Пожалуйста, задайте вопрос по исламскому праву (фикху). Например: <em>«Как делать омовение?»</em>";

    // Score each DB entry
    const scores = new Array(FIQH_DB.length).fill(0);

    for (const word of words) {
        // 1. Direct key match
        for (let i = 0; i < FIQH_DB.length; i++) {
            for (const key of FIQH_DB[i].keys) {
                if (key.includes(word) || word.includes(key)) {
                    scores[i] += 3;
                }
            }
        }

        // 2. Stem-based match
        for (const [stem, topic] of Object.entries(STEMS)) {
            if (word.startsWith(stem) || stem.startsWith(word.substring(0, Math.min(word.length, 4)))) {
                // Find entries matching this topic
                for (let i = 0; i < FIQH_DB.length; i++) {
                    for (const key of FIQH_DB[i].keys) {
                        if (key.includes(topic) || topic.includes(key)) {
                            scores[i] += 2;
                        }
                    }
                }
            }
        }
    }

    // Find best match
    let bestIdx = -1, bestScore = 0;
    for (let i = 0; i < scores.length; i++) {
        if (scores[i] > bestScore) { bestScore = scores[i]; bestIdx = i; }
    }

    if (bestScore >= 3 && bestIdx >= 0) {
        const entry = FIQH_DB[bestIdx];
        return `<strong>${entry.title}</strong><br><br>${entry.answer}`;
    }

    // No match — suggest search + show topics
    const topics = FIQH_DB.map(e => e.title).filter(t => t !== "Приветствие! 👋");
    const topicList = topics.slice(0, 10).map(t => `• ${t}`).join("<br>");
    const searchQ = encodeURIComponent(query + " фикх исламское право");

    return `К сожалению, я не нашёл точного ответа на ваш вопрос в базе знаний.<br><br>
<strong>Попробуйте:</strong><br>
🔍 <a href="https://www.google.com/search?q=${searchQ}" target="_blank" style="color:#14b8a6">Поиск в Google</a><br>
🔍 <a href="https://islamqa.info/ru/search?q=${encodeURIComponent(query)}" target="_blank" style="color:#14b8a6">Поиск на IslamQA</a><br><br>
<strong>Или спросите по одной из этих тем:</strong><br>${topicList}<br>... и ещё ${topics.length - 10} тем.`;
}

function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
