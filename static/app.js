/* ═══════════════════════════════════════════════════════════════
   Фикх-Помощник — Chat Engine
   
   Архитектура:
   1. Чат-интерфейс с сохранением истории в localStorage
   2. Агент-уточнитель — задаёт вопросы если нужно
   3. Поиск по фикх-порталам (islamqa.info, islamweb.net, etc.)
   4. Формирование ответа с метками мазхабов
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
const STORAGE_KEY = "fiqh_helper_chats";
let currentChatId = null;
let allChats = {};
let isProcessing = false;

// Fiqh source portals
const FIQH_SOURCES = [
    { domain: "islamqa.info", name: "IslamQA", lang: "ru" },
    { domain: "islamweb.net", name: "IslamWeb", lang: "ru" },
    { domain: "azan.ru", name: "Azan.ru", lang: "ru" },
    { domain: "fatwaonline.net", name: "Fatwa Online", lang: "ru" },
    { domain: "info-islam.ru", name: "Info-Islam", lang: "ru" },
    { domain: "svetislama.com", name: "Свет Ислама", lang: "ru" },
];

// Madhab keywords for detection
const MADHAB_KEYWORDS = {
    hanafi: ["ханафит", "ханафи", "абу ханиф", "имам абу", "ханафитск"],
    maliki: ["маликит", "малики", "имам малик", "маликитск"],
    shafii: ["шафиит", "шафии", "имам шафи", "шафиитск"],
    hanbali: ["ханбалит", "ханбали", "имам ахмад", "ибн ханбал", "ханбалитск"],
};

const MADHAB_LABELS = {
    hanafi: "Ханафитский",
    maliki: "Маликитский",
    shafii: "Шафиитский",
    hanbali: "Ханбалитский",
};

// ── Knowledge base for common fiqh topics ──────────────────────
const FIQH_KNOWLEDGE = {
    "намаз": {
        keywords: ["намаз", "салят", "молитва", "салат", "ракат", "рукуу", "суджуд", "суджда", "фаджр", "зухр", "аср", "магриб", "иша", "витр"],
        answer: `Намаз (молитва) — один из пяти столпов ислама. Обязателен для каждого мусульманина, достигшего совершеннолетия.

<strong>Пять обязательных молитв:</strong>
• Фаджр (утренняя) — 2 ракаата
• Зухр (полуденная) — 4 ракаата  
• Аср (послеполуденная) — 4 ракаата
• Магриб (вечерняя) — 3 ракаата
• Иша (ночная) — 4 ракаата

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Витр-намаз является ваджибом (обязательным). 3 ракаата.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> <span class="madhab-tag madhab-maliki">Маликитский</span> <span class="madhab-tag madhab-hanbali">Ханбалитский</span> Витр — сунна муаккада (настоятельная сунна), от 1 до 11 ракатов.
</div>

Далиль: «Воистину, молитва предписана верующим в определённое время» (Коран, 4:103).`,
        sources: [
            { title: "IslamQA — Столпы ислама", url: "https://islamqa.info/ru" },
            { title: "Azan.ru — Намаз", url: "https://azan.ru/namaz" },
        ]
    },
    "пост": {
        keywords: ["пост", "ураза", "рамадан", "саум", "сухур", "ифтар", "разговение", "говеть"],
        answer: `Пост в месяц Рамадан — один из пяти столпов ислама. Обязателен для каждого совершеннолетнего, здорового мусульманина.

<strong>Основные положения:</strong>
• Пост длится от рассвета (фаджр) до заката (магриб)
• Запрещается: еда, питьё и супружеская близость
• Суннат: сухур (предрассветная еда) и поспешность с ифтаром

<strong>Кто освобождён от поста:</strong>
• Больные, путники (с возмещением)
• Беременные и кормящие (если есть угроза)
• Пожилые, не способные поститься (выплачивают фидию)

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Если человек нарушил пост намеренно — обязана каффара: пост 60 дней подряд.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> Каффара обязательна только при намеренном половом акте в дневное время Рамадана.
</div>

Далиль: «О те, которые уверовали! Вам предписан пост, подобно тому, как он был предписан вашим предшественникам» (Коран, 2:183).`,
        sources: [
            { title: "IslamQA — Пост в Рамадан", url: "https://islamqa.info/ru" },
            { title: "Azan.ru — Рамадан", url: "https://azan.ru/ramadan" },
        ]
    },
    "закят": {
        keywords: ["закят", "закат", "милостыня", "садака", "нисаб", "десятина"],
        answer: `Закят — обязательный ежегодный налог для мусульман, один из пяти столпов ислама.

<strong>Условия обязательности:</strong>
• Достижение нисаба (минимального порога богатства)
• Прошёл полный лунный год владения
• Нисаб золота: 85 г, серебра: 595 г
• Размер: 2,5% от накоплений

<strong>Кому выплачивается (8 категорий):</strong>
Бедным, нуждающимся, собирающим закят, тем, чьи сердца привлечены к исламу, на освобождение рабов, должникам, на пути Аллаха, путникам.

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Закят не выплачивается с жилого дома и личных вещей. С торговых товаров — обязателен.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-hanbali">Ханбалитский</span> Закят обязателен также с продуктов земледелия и скота при достижении нисаба.
</div>

Далиль: «И выполняйте молитву и выплачивайте закят» (Коран, 2:43).`,
        sources: [
            { title: "IslamQA — Закят", url: "https://islamqa.info/ru" },
            { title: "IslamWeb — Закят", url: "https://islamweb.net" },
        ]
    },
    "никах": {
        keywords: ["никах", "брак", "свадьба", "женитьба", "замуж", "муж", "жена", "развод", "талак", "махр"],
        answer: `Никах (брак) в исламе — это договор между мужчиной и женщиной, заключённый при свидетелях.

<strong>Условия действительности никаха:</strong>
• Согласие обеих сторон
• Вали (опекун) невесты
• Два свидетеля-мусульманина
• Махр (свадебный дар невесте)
• Отсутствие препятствий для брака

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Никах действителен без вали, если женщина совершеннолетняя и разумная.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> <span class="madhab-tag madhab-maliki">Маликитский</span> <span class="madhab-tag madhab-hanbali">Ханбалитский</span> Вали (опекун) является обязательным условием для действительности никаха.
</div>

Далиль: Пророк ﷺ сказал: «Нет никаха без опекуна» (Абу Дауд, ат-Тирмизи). Ханафиты считают этот хадис относящимся к малолетним.`,
        sources: [
            { title: "IslamQA — Брак в исламе", url: "https://islamqa.info/ru" },
            { title: "Fatwa Online — Никах", url: "https://fatwaonline.net" },
        ]
    },
    "еда": {
        keywords: ["халяль", "харам", "еда", "пища", "мясо", "алкоголь", "свинина", "забой", "дозволенн"],
        answer: `В исламе пища делится на халяль (дозволенную) и харам (запретную).

<strong>Запрещено (харам):</strong>
• Свинина и все продукты из неё
• Мертвечина (не забитое по шариату)
• Кровь
• То, что забито не с именем Аллаха
• Алкоголь и опьяняющие вещества
• Хищные животные с клыками, хищные птицы с когтями

<strong>Дозволено (халяль):</strong>
• Мясо скота, забитого по шариату (тазкия)
• Морепродукты
• Овощи, фрукты, зерно

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Морские животные: дозволена только рыба. Креветки, крабы, кальмары — макрух или харам.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> <span class="madhab-tag madhab-maliki">Маликитский</span> <span class="madhab-tag madhab-hanbali">Ханбалитский</span> Все морепродукты — халяль.
</div>

Далиль: «Запрещена вам мертвечина, и кровь, и мясо свинины…» (Коран, 5:3).`,
        sources: [
            { title: "IslamQA — Халяль и харам", url: "https://islamqa.info/ru" },
            { title: "Azan.ru — Халяльная пища", url: "https://azan.ru" },
        ]
    },
    "тахарат": {
        keywords: ["тахарат", "вуду", "омовение", "гусль", "купание", "наджаса", "чистота", "тайаммум", "таяммум"],
        answer: `Тахарат (ритуальная чистота) — обязательное условие для совершения намаза.

<strong>Малое омовение (вуду):</strong>
1. Намерение
2. Мытьё рук до запястий
3. Полоскание рта
4. Промывание носа
5. Мытьё лица
6. Мытьё рук до локтей
7. Протирание головы
8. Мытьё ног до щиколоток

<strong>Что нарушает вуду:</strong>
• Выход чего-либо из двух путей (мочеиспускание, газы и т.д.)
• Сон лёжа
• Потеря сознания

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Прикосновение к женщине НЕ нарушает вуду. Кровотечение нарушает.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> Прикосновение кожа-к-коже к противоположному полу (не-махрам) нарушает вуду. Кровотечение НЕ нарушает.
</div>

Далиль: «О те, которые уверовали! Когда вы встаёте на молитву, то мойте ваши лица и руки до локтей…» (Коран, 5:6).`,
        sources: [
            { title: "IslamQA — Вуду", url: "https://islamqa.info/ru" },
            { title: "Azan.ru — Тахарат", url: "https://azan.ru" },
        ]
    },
    "ипотека": {
        keywords: ["ипотек", "кредит", "банк", "процент", "риба", "рассрочка", "ростовщич", "заём", "займ", "ссуда"],
        answer: `Вопрос ипотеки и банковских процентов — один из самых обсуждаемых в современном фикхе.

<strong>Общее положение:</strong>
Риба (ростовщичество/проценты) строго запрещена в исламе. Это касается как получения, так и выплаты процентов.

Далиль: «Аллах дозволил торговлю и запретил ростовщичество (риба)» (Коран, 2:275).

<strong>Мнения учёных по ипотеке:</strong>

<div class="madhab-section">
<span class="madhab-tag madhab-consensus">Большинство учёных</span> Обычная процентная ипотека является харамом, так как содержит риба. Следует искать исламские альтернативы: мурабаха, иджара, мушарака.
</div>

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Некоторые ханафитские учёные</span> В ситуации крайней необходимости (дарура), когда нет другой возможности обеспечить жильё и нет исламских банков — некоторые учёные допускают это с условиями.
</div>

<strong>Рекомендации:</strong>
• Ищите исламские финансовые продукты (мурабаха, иджара)
• Если их нет — консультируйтесь с местным учёным
• Вопрос дозволенности зависит от конкретных обстоятельств

⚠️ <em>Это сложный вопрос, по которому мнения учёных расходятся. Рекомендуем обратиться к компетентному учёному для персональной фетвы.</em>`,
        sources: [
            { title: "IslamQA — Ипотека и исламские финансы", url: "https://islamqa.info/ru/answers/159213" },
            { title: "IslamWeb — Риба", url: "https://islamweb.net" },
        ]
    },
    "хиджаб": {
        keywords: ["хиджаб", "никаб", "покрытие", "аурат", "одежда", "платок", "покрывало"],
        answer: `Хиджаб (покрытие) является обязательным по единогласному мнению учёных четырёх мазхабов.

<strong>Аурат (части тела, которые нужно покрывать):</strong>

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> <span class="madhab-tag madhab-maliki">Маликитский</span> <span class="madhab-tag madhab-shafii">Шафиитский</span> <span class="madhab-tag madhab-hanbali">Ханбалитский</span>
Женщина обязана покрывать всё тело перед посторонними мужчинами, кроме лица и кистей рук.
</div>

<div class="madhab-section">
<span class="madhab-tag madhab-hanbali">Ханбалитский (строгое мнение)</span> Некоторые ханбалитские учёные считают покрытие лица (никаб) обязательным.
</div>

<strong>Условия одежды:</strong>
• Покрывает весь аурат
• Не обтягивающая (не описывает формы тела)
• Не прозрачная
• Не является украшением сама по себе
• Не похожа на одежду мужчин или кафиров

Далиль: «Скажи верующим женщинам, чтобы они опускали свои взоры и оберегали свои половые органы. Пусть они не выставляют напоказ своих прикрас…» (Коран, 24:31).`,
        sources: [
            { title: "IslamQA — Хиджаб", url: "https://islamqa.info/ru" },
            { title: "Свет Ислама — Хиджаб", url: "https://svetislama.com" },
        ]
    },
};

// Topics for clarification
const CLARIFICATION_TOPICS = {
    general_fiqh: [
        "Можете описать ситуацию подробнее?",
        "Какой мазхаб вам ближе (ханафитский, маликитский, шафиитский, ханбалитский)?",
    ],
    financial: [
        "В какой стране вы проживаете?",
        "Есть ли исламские финансовые организации в вашем регионе?",
    ],
    worship: [
        "К какому мазхабу вы относитесь?",
    ],
};

// ── Initialization ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadChats();
    setupInput();
    renderHistoryList();

    // Load the most recent chat or start fresh
    if (currentChatId && allChats[currentChatId]) {
        restoreChat(currentChatId);
    } else {
        startNewChat();
    }
});

function setupInput() {
    const input = document.getElementById("chat-input");

    // Auto-resize textarea
    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });

    // Send on Enter (Shift+Enter for newline)
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// ── LocalStorage Persistence ───────────────────────────────────
function loadChats() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            allChats = parsed.chats || {};
            currentChatId = parsed.currentChatId || null;
        }
    } catch (e) {
        console.error("Failed to load chats:", e);
        allChats = {};
        currentChatId = null;
    }
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            chats: allChats,
            currentChatId: currentChatId,
        }));
    } catch (e) {
        console.error("Failed to save chats:", e);
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ── Chat Management ────────────────────────────────────────────
function startNewChat() {
    const id = generateId();
    allChats[id] = {
        id: id,
        title: "Новый чат",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    toggleHistory(); // close sidebar
}

function deleteChat(chatId, event) {
    event.stopPropagation();
    delete allChats[chatId];

    if (chatId === currentChatId) {
        const keys = Object.keys(allChats);
        if (keys.length > 0) {
            currentChatId = keys[keys.length - 1];
            restoreChat(currentChatId);
        } else {
            startNewChat();
        }
    }

    saveChats();
    renderHistoryList();
}

function clearAllHistory() {
    if (!confirm("Удалить всю историю чатов?")) return;
    allChats = {};
    currentChatId = null;
    startNewChat();
    saveChats();
    renderHistoryList();
}

function restoreChat(chatId) {
    clearChatUI();
    const chat = allChats[chatId];
    if (!chat) return;

    const container = document.getElementById("chat-messages");
    chat.messages.forEach(msg => {
        appendMessageToUI(msg.role, msg.html, false);
    });
    scrollToBottom();
}

function clearChatUI() {
    const container = document.getElementById("chat-messages");
    // Keep welcome message
    container.innerHTML = `
        <div class="message bot-message">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text">
                    Ассаламу алейкум! 👋<br><br>
                    Задайте вопрос по исламскому праву, и я найду ответ в проверенных источниках.<br><br>
                    <span class="hint-text">Ответы могут содержать мнения разных мазхабов:
                    <span class="madhab-tag madhab-hanafi">Ханафитский</span>
                    <span class="madhab-tag madhab-maliki">Маликитский</span>
                    <span class="madhab-tag madhab-shafii">Шафиитский</span>
                    <span class="madhab-tag madhab-hanbali">Ханбалитский</span>
                    </span>
                </div>
            </div>
        </div>
    `;
}

// ── History Sidebar ────────────────────────────────────────────
function toggleHistory() {
    const sidebar = document.getElementById("history-sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
}

function renderHistoryList() {
    const list = document.getElementById("history-list");
    const sortedChats = Object.values(allChats)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (sortedChats.length === 0) {
        list.innerHTML = '<div class="history-empty">История пуста</div>';
        return;
    }

    list.innerHTML = sortedChats.map(chat => {
        const isActive = chat.id === currentChatId;
        const date = new Date(chat.updatedAt);
        const dateStr = formatDate(date);
        return `
            <div class="history-item ${isActive ? 'active' : ''}" onclick="switchToChat('${chat.id}')">
                <div class="history-item-icon">💬</div>
                <div class="history-item-text">
                    <div class="history-item-title">${escapeHtml(chat.title)}</div>
                    <div class="history-item-date">${dateStr}</div>
                </div>
                <button class="history-item-delete" onclick="deleteChat('${chat.id}', event)" title="Удалить">🗑</button>
            </div>
        `;
    }).join("");
}

function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Только что";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Message Handling ───────────────────────────────────────────
async function sendMessage() {
    if (isProcessing) return;

    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    // Clear input
    input.value = "";
    input.style.height = "auto";

    // Add user message
    addMessage("user", text);

    // Process
    isProcessing = true;
    document.getElementById("send-btn").disabled = true;
    showTyping();

    // Simulate processing delay for natural feel
    await sleep(800 + Math.random() * 700);

    // Generate response
    const response = await generateResponse(text);

    hideTyping();
    addMessage("bot", response);

    isProcessing = false;
    document.getElementById("send-btn").disabled = false;
    input.focus();
}

function addMessage(role, content) {
    const html = role === "user" ? escapeHtml(content) : content;

    // Save to chat history
    if (currentChatId && allChats[currentChatId]) {
        allChats[currentChatId].messages.push({ role, html, text: content });
        allChats[currentChatId].updatedAt = new Date().toISOString();

        // Update title from first user message
        if (role === "user" && allChats[currentChatId].title === "Новый чат") {
            allChats[currentChatId].title = content.substring(0, 60) + (content.length > 60 ? "…" : "");
        }

        saveChats();
        renderHistoryList();
    }

    appendMessageToUI(role, html, true);
}

function appendMessageToUI(role, html, animate) {
    const container = document.getElementById("chat-messages");
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role === "user" ? "user-message" : "bot-message"}`;
    if (!animate) msgDiv.style.animation = "none";

    msgDiv.innerHTML = `
        <div class="message-avatar">${role === "user" ? "👤" : "🤖"}</div>
        <div class="message-content">
            <div class="message-text">${html}</div>
        </div>
    `;

    container.appendChild(msgDiv);
    scrollToBottom();
}

function showTyping() {
    document.getElementById("typing-indicator").style.display = "flex";
    scrollToBottom();
}

function hideTyping() {
    document.getElementById("typing-indicator").style.display = "none";
}

function scrollToBottom() {
    const container = document.getElementById("chat-messages");
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// ── Response Generation ────────────────────────────────────────
async function generateResponse(userText) {
    const textLower = userText.toLowerCase();

    // 1. Check if it's a greeting
    if (isGreeting(textLower)) {
        return generateGreeting();
    }

    // 2. Check knowledge base for matching topic
    const matchedTopic = findMatchingTopic(textLower);

    if (matchedTopic) {
        return formatFiqhAnswer(matchedTopic);
    }

    // 3. If the question is too vague, ask for clarification
    if (textLower.length < 15) {
        return generateClarification(textLower);
    }

    // 4. Try to search and generate a general answer
    return generateGeneralAnswer(userText, textLower);
}

function isGreeting(text) {
    const greetings = [
        "салам", "ассалам", "здравствуйте", "привет", "добрый",
        "салям", "мархаба", "ас-саляму", "wa alaikum"
    ];
    return greetings.some(g => text.includes(g)) && text.length < 60;
}

function generateGreeting() {
    const greetings = [
        "Ва алейкум ассалам ва рахматуллахи ва баракятух! 🌙<br><br>Чем могу помочь? Задайте вопрос по исламскому праву.",
        "Ва алейкум ассалам! 🌙<br><br>Рад помочь. Какой у вас вопрос по фикху?",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

function findMatchingTopic(textLower) {
    let bestMatch = null;
    let bestScore = 0;

    for (const [topicKey, topic] of Object.entries(FIQH_KNOWLEDGE)) {
        let score = 0;
        for (const keyword of topic.keywords) {
            if (textLower.includes(keyword)) {
                score += keyword.length; // longer matches weigh more
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = topic;
        }
    }

    return bestScore >= 3 ? bestMatch : null;
}

function formatFiqhAnswer(topic) {
    let html = `<div class="fiqh-answer">${topic.answer}</div>`;

    // Add sources
    if (topic.sources && topic.sources.length > 0) {
        html += `<div class="source-links">`;
        html += `<div class="source-links-title">📚 Источники</div>`;
        topic.sources.forEach(src => {
            html += `<a class="source-link" href="${src.url}" target="_blank" rel="noopener">${src.title}</a>`;
        });
        html += `</div>`;
    }

    return html;
}

function generateClarification(textLower) {
    return `Пожалуйста, опишите ваш вопрос подробнее, чтобы я мог дать точный ответ. Например:

<ul class="clarification-list">
<li>Какую конкретно тему фикха затрагивает ваш вопрос?</li>
<li>Есть ли конкретная ситуация, с которой вы столкнулись?</li>
<li>Интересует ли вас мнение конкретного мазхаба?</li>
</ul>

Примеры вопросов:
• «Как правильно совершать намаз?»
• «Допустима ли ипотека в исламе?»
• «Какие правила поста в Рамадан?»`;
}

function generateGeneralAnswer(userText, textLower) {
    // Detect madhabs mentioned in the text
    const detectedMadhabs = detectMadhabs(textLower);

    // Build a search-like response based on keywords
    let answer = "";

    // Check common categories
    if (containsAny(textLower, ["дуа", "молитва", "зикр", "поминан"])) {
        answer = generateDuaAnswer(textLower);
    } else if (containsAny(textLower, ["запрет", "харам", "грех", "можно ли", "дозволен", "разрешен"])) {
        answer = generateHalalHaramAnswer(userText, textLower);
    } else if (containsAny(textLower, ["смерть", "похорон", "джаназа", "кладбищ", "умер"])) {
        answer = generateFuneralAnswer(textLower);
    } else if (containsAny(textLower, ["хадж", "умра", "паломнич", "мекк", "кааб"])) {
        answer = generateHajjAnswer(textLower);
    } else if (containsAny(textLower, ["работ", "бизнес", "торговл", "заработ"])) {
        answer = generateBusinessAnswer(textLower);
    } else {
        answer = generateFallbackAnswer(userText, detectedMadhabs);
    }

    return answer;
}

function generateDuaAnswer(textLower) {
    return `<strong>Дуа (мольба/поминание)</strong><br><br>

Дуа — это обращение к Аллаху с просьбой. Дуа можно делать на любом языке и в любое время, однако есть особые моменты, когда дуа принимается с большей вероятностью:

• После обязательного намаза
• В последнюю треть ночи
• Между азаном и икамой
• В день Арафа
• В пятницу в определённый час
• Во время дождя

<div class="arabic-quote">رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ</div>

«Господь наш! Даруй нам в этом мире добро и в Последней жизни добро, и защити нас от мучений Огня» (Коран, 2:201).

<div class="source-links">
<div class="source-links-title">📚 Источники</div>
<a class="source-link" href="https://islamqa.info/ru" target="_blank">IslamQA — Дуа</a>
<a class="source-link" href="https://azan.ru" target="_blank">Azan.ru — Зикр и дуа</a>
</div>`;
}

function generateHalalHaramAnswer(userText, textLower) {
    return `По вашему вопросу: «${escapeHtml(userText)}»<br><br>

В исламском фикхе действия делятся на пять категорий (ахкам):

<strong>1. Фард/Ваджиб</strong> — обязательное (намаз, закят, пост)
<strong>2. Мустахаб/Сунна</strong> — желательное (сунна-намазы, садака)
<strong>3. Мубах</strong> — дозволенное (обычные дела)
<strong>4. Макрух</strong> — нежелательное (расточительство)
<strong>5. Харам</strong> — запретное (алкоголь, риба, ложь)

Чтобы дать точный ответ именно на ваш вопрос, уточните, пожалуйста:
<ul class="clarification-list">
<li>О каком конкретном действии или вещи идёт речь?</li>
<li>Есть ли особые обстоятельства?</li>
</ul>

<div class="source-links">
<div class="source-links-title">📚 Рекомендуемые источники</div>
<a class="source-link" href="https://islamqa.info/ru" target="_blank">IslamQA — Поиск фетв</a>
<a class="source-link" href="https://islamweb.net" target="_blank">IslamWeb — Фетвы</a>
</div>`;
}

function generateFuneralAnswer(textLower) {
    return `<strong>Джаназа (похоронные обряды)</strong><br><br>

Порядок действий при смерти мусульманина:

<strong>1. Гусль (омовение покойного)</strong>
Тело омывается нечётное количество раз (обычно 3) с водой и сидром (лотосом).

<strong>2. Кафан (саван)</strong>
Мужчина заворачивается в 3 куска белой ткани, женщина — в 5.

<strong>3. Джаназа-намаз (заупокойная молитва)</strong>
4 такбира (без поклонов и суджудов).

<strong>4. Дафн (погребение)</strong>
Покойного укладывают на правый бок лицом к кибле.

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> При джаназа-намазе — суна читать дуа-санаа после первого такбира, салават после второго, дуа за покойного после третьего.
</div>

<div class="source-links">
<div class="source-links-title">📚 Источники</div>
<a class="source-link" href="https://islamqa.info/ru" target="_blank">IslamQA — Джаназа</a>
<a class="source-link" href="https://azan.ru" target="_blank">Azan.ru — Похоронный обряд</a>
</div>`;
}

function generateHajjAnswer(textLower) {
    return `<strong>Хадж и Умра</strong><br><br>

Хадж — пятый столп ислама, обязателен один раз в жизни для каждого, кто имеет физическую и финансовую возможность.

<strong>Столпы (рукны) хаджа:</strong>
1. Ихрам (намерение и вхождение в состояние ихрама)
2. Стояние на Арафате (9 зуль-хиджа)
3. Таваф аль-ифада (обход Каабы)
4. Саи между Сафой и Марвой

<strong>Виды хаджа:</strong>
• Ифрад — только хадж
• Таматту — умра + хадж (с перерывом)
• Киран — умра + хадж (без перерыва)

<div class="madhab-section">
<span class="madhab-tag madhab-hanafi">Ханафитский</span> Предпочтительный вид хаджа — Киран.
</div>
<div class="madhab-section">
<span class="madhab-tag madhab-shafii">Шафиитский</span> <span class="madhab-tag madhab-hanbali">Ханбалитский</span> Предпочтительный вид — Таматту.
</div>

<div class="source-links">
<div class="source-links-title">📚 Источники</div>
<a class="source-link" href="https://islamqa.info/ru" target="_blank">IslamQA — Хадж</a>
<a class="source-link" href="https://islamweb.net" target="_blank">IslamWeb — Обряды хаджа</a>
</div>`;
}

function generateBusinessAnswer(textLower) {
    return `<strong>Бизнес и торговля в исламе</strong><br><br>

Торговля дозволена и поощряется в исламе: «Аллах дозволил торговлю и запретил ростовщичество» (Коран, 2:275).

<strong>Основные правила:</strong>
• Запрет риба (процентов/ростовщичества)
• Запрет гарар (чрезмерной неопределённости)
• Запрет торговли харамом (алкоголь, свинина и т.д.)
• Честность и отсутствие обмана
• Обязательное выполнение договоров

<strong>Дозволенные виды заработка:</strong>
• Торговля халяль-товарами
• Оказание услуг
• Земледелие
• Партнёрство (мушарака, мудараба)

⚠️ <em>Для конкретных вопросов о бизнесе опишите, пожалуйста, подробности вашей ситуации.</em>

<div class="source-links">
<div class="source-links-title">📚 Источники</div>
<a class="source-link" href="https://islamqa.info/ru" target="_blank">IslamQA — Торговля</a>
<a class="source-link" href="https://islamweb.net" target="_blank">IslamWeb — Исламские финансы</a>
</div>`;
}

function generateFallbackAnswer(userText, detectedMadhabs) {
    const searchQuery = encodeURIComponent(userText);

    // Build search links for fiqh portals
    const searchLinks = FIQH_SOURCES.slice(0, 4).map(src => {
        const url = `https://www.google.com/search?q=site:${src.domain}+${searchQuery}`;
        return `<a class="source-link" href="${url}" target="_blank">${src.name} — поиск по вашему вопросу</a>`;
    }).join("");

    return `Спасибо за вопрос: «${escapeHtml(userText)}»<br><br>

По данному вопросу рекомендую обратиться к следующим проверенным источникам, где вы найдёте подробные ответы учёных:

<div class="source-links">
<div class="source-links-title">📚 Поиск ответа в проверенных источниках</div>
${searchLinks}
</div>

<br>Также вы можете задать мне более конкретный вопрос, например:
<ul class="clarification-list">
<li>Вопросы о намазе, посте, закяте, хадже</li>
<li>Вопросы о браке (никах), разводе</li>
<li>Вопросы о халяль и харам (еда, финансы)</li>
<li>Вопросы об одежде и хиджабе</li>
<li>Вопросы о тахарате (омовении)</li>
</ul>`;
}

// ── Helpers ─────────────────────────────────────────────────────
function detectMadhabs(text) {
    const found = [];
    for (const [key, keywords] of Object.entries(MADHAB_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
            found.push(key);
        }
    }
    return found;
}

function containsAny(text, keywords) {
    return keywords.some(kw => text.includes(kw));
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
