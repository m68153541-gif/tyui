console.log('🦄 Забава Игра v2.0');

// ============================================================
//  ID (НОВЫЙ - 5 ЦИФР)
// ============================================================

function generateNewUid() {
    let uid = '';
    for (let i = 0; i < 5; i++) {
        uid += Math.floor(Math.random() * 10);
    }
    return uid;
}

function getTelegramUserId() {
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                return String(tg.initDataUnsafe.user.id);
            }
        }
    } catch(e) {}
    return null;
}

function getUserId() {
    const tgId = getTelegramUserId();
    if (tgId) {
        return 'tg_' + tgId;
    }
    let userId = localStorage.getItem('game_user_id');
    if (!userId) {
        userId = 'local_' + Date.now();
        localStorage.setItem('game_user_id', userId);
    }
    return userId;
}

// ============================================================
//  ГЛОБАЛЬНЫЕ ДАННЫЕ
// ============================================================

window.users = window.users || {};
window.uidMap = window.uidMap || {};
window.bannedUsers = window.bannedUsers || {};
window.codes = window.codes || {}; // {code: {used_by: [], type: 'attempts'}}

const SERVER_URL = window.location.origin;

// ============================================================
//  СОХРАНЕНИЕ / ЗАГРУЗКА
// ============================================================

function saveAllData() {
    try {
        const data = {
            users: window.users,
            uidMap: window.uidMap,
            bannedUsers: window.bannedUsers,
            codes: window.codes
        };
        localStorage.setItem('zabava_game_full_data_v2', JSON.stringify(data));
        return true;
    } catch(e) { return false; }
}

function loadAllData() {
    try {
        const data = localStorage.getItem('zabava_game_full_data_v2');
        if (data) {
            const parsed = JSON.parse(data);
            window.users = parsed.users || {};
            window.uidMap = parsed.uidMap || {};
            window.bannedUsers = parsed.bannedUsers || {};
            window.codes = parsed.codes || {};
            return true;
        }
    } catch(e) {}
    return false;
}

loadAllData();

// ============================================================
//  ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function generateCode(len = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getUser(userId) {
    if (!window.users[userId]) {
        const newUid = generateNewUid();
        window.users[userId] = {
            username: null,
            attempts: 10,
            wins: [],
            boosted: false,
            stars: 300,
            petProgress: 0,
            uid: newUid,
            coefficientRate: 0.0,
            petStage: 1,
            lastPassiveTime: Date.now(),
            bank: 0,
            bankDeposit: 0,
            bankTime: Date.now(),
            registered: false,
            name: null,
            gender: null,
            age: null,
            clickerProgress: 0,
            notifications: [],
            banned: false,
            banned_reason: '',
            registrationDate: new Date().toISOString(),
            chatMessages: [],
            lastAttemptsAdd: Date.now()
        };
        window.uidMap[newUid] = userId;
        saveAllData();
        saveToServer();
    }
    return window.users[userId];
}

function getCurrentUser() {
    return getUser(getUserId());
}

function getUserByUid(uid) {
    const userId = window.uidMap[uid];
    if (userId) return getUser(userId);
    for (const id in window.users) {
        if (window.users[id].uid === uid) {
            return window.users[id];
        }
    }
    return null;
}

function getAllUsersList() {
    const result = [];
    for (const userId in window.users) {
        const user = window.users[userId];
        if (user && user.uid) {
            result.push({
                userId: userId,
                uid: user.uid,
                name: user.name || '—',
                stars: user.stars || 0,
                bank: user.bank || 0,
                attempts: user.attempts || 0,
                registered: user.registered || false,
                banned: user.banned || false
            });
        }
    }
    return result;
}

// ============================================================
//  АВТО-НАЧИСЛЕНИЕ ПОПЫТОК (КАЖДЫЙ ЧАС)
// ============================================================

function addAttemptsPerHour() {
    const user = getCurrentUser();
    if (!user || !user.registered || user.banned) return;
    
    const now = Date.now();
    const lastAdd = user.lastAttemptsAdd || now;
    const hoursPassed = Math.floor((now - lastAdd) / 3600000);
    
    if (hoursPassed > 0) {
        user.attempts = (user.attempts || 0) + hoursPassed;
        user.lastAttemptsAdd = now;
        saveAllData();
        saveToServer();
        if (hoursPassed > 0) {
            showToast('⏰ +' + hoursPassed + ' попыток (ежечасный бонус)');
            render();
        }
    }
}

setInterval(addAttemptsPerHour, 60000); // Проверяем каждую минуту

// ============================================================
//  БАНК (10 ЗВЕЗД В МИНУТУ)
// ============================================================

function processBank() {
    const user = getCurrentUser();
    if (!user || !user.registered || user.banned) return;
    
    const now = Date.now();
    const bankTime = user.bankTime || now;
    const bankDeposit = user.bankDeposit || 0;
    
    if (bankDeposit > 0) {
        const minutesPassed = Math.floor((now - bankTime) / 60000);
        
        if (minutesPassed > 0) {
            const earned = minutesPassed * 10;
            user.bank = (user.bank || 0) + earned;
            user.bankTime = now;
            saveAllData();
            saveToServer();
            if (earned > 0) {
                showToast('🏦 Банк: +' + earned + ' ⭐ (10⭐/мин)');
            }
            render();
        }
    }
}

setInterval(processBank, 10000);

// ============================================================
//  КОЭФФИЦИЕНТ (15%)
// ============================================================

function handleCoeff() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    openModal('🔥 Коэффициент (15%)', `
        <p>Введите сумму (15% станут коэффициентом):</p>
        <input type="number" id="coeffInput" placeholder="Сумма" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" onclick="setCoeff()">💎 Применить</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.setCoeff = function() {
    const user = getCurrentUser();
    const input = document.getElementById('coeffInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    if (user.stars < amount) { showToast('Недостаточно звёзд'); return; }
    user.stars -= amount;
    user.coefficientRate = Math.round(amount * 0.15 * 10) / 10;
    closeModal();
    showToast('Коэффициент: +' + user.coefficientRate + ' ⭐ (15%)');
    render();
    saveAllData();
    saveToServer();
};

// ============================================================
//  ПИТОМЕЦ (С ПАССИВНЫМ ДОХОДОМ)
// ============================================================

function processPetPassive() {
    const user = getCurrentUser();
    if (!user || !user.registered || user.banned) return;
    
    const now = Date.now();
    const lastTime = user.lastPassiveTime || now;
    const hoursPassed = Math.floor((now - lastTime) / 3600000);
    
    if (hoursPassed > 0) {
        const stage = user.petStage || 1;
        const passiveRates = { 1: 0, 2: 20, 3: 50, 4: 100 };
        const rate = passiveRates[stage] || 0;
        
        if (rate > 0) {
            const earned = rate * hoursPassed;
            user.stars = (user.stars || 0) + earned;
            user.lastPassiveTime = now;
            saveAllData();
            saveToServer();
            showToast('🦄 Питомец: +' + earned + ' ⭐ (пассивный доход)');
            render();
        }
    }
}

setInterval(processPetPassive, 60000);

function handlePet() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const thresholds = { 1: 100, 2: 500, 3: 1500, 4: 3000 };
    const threshold = thresholds[stage] || 0;
    const stageNames = { 1: '🦄 Малыш', 2: '🦄 Подросток', 3: '🦄 Взрослый', 4: '🦄 Легендарный' };
    const passiveRates = { 1: 0, 2: 20, 3: 50, 4: 100 };
    const passive = passiveRates[stage] || 0;

    openModal('🦄 Питомец', `
        <p><strong>${stageNames[stage] || 'Малыш'}</strong></p>
        <p>Прогресс: ${progress} / ${threshold} ⭐</p>
        <p>Пассивный доход: ${passive} ⭐/час</p>
        <input type="number" id="petFeedInput" placeholder="Сколько звёзд скормить?" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" onclick="feedPet()">🍖 Покормить</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.feedPet = function() {
    const user = getCurrentUser();
    const input = document.getElementById('petFeedInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    if (user.stars < amount) { showToast('Недостаточно звёзд'); return; }
    
    const stage = user.petStage || 1;
    const thresholds = { 1: 100, 2: 500, 3: 1500, 4: 3000 };
    const threshold = thresholds[stage] || 0;
    const maxFeed = threshold - user.petProgress;
    if (amount > maxFeed && threshold > 0) {
        showToast('Максимум ' + maxFeed + ' ⭐');
        return;
    }
    
    user.stars -= amount;
    user.petProgress += amount;

    if (threshold > 0 && user.petProgress >= threshold) {
        user.petProgress = 0;
        if (stage === 1) {
            user.stars += 500;
            user.petStage = 2;
            showToast('🎉 Стадия 2! +500 ⭐');
        } else if (stage === 2) {
            user.stars += 1000;
            user.petStage = 3;
            showToast('🎉 Стадия 3! +1000 ⭐');
        } else if (stage === 3) {
            user.stars += 2000;
            user.petStage = 4;
            showToast('🎉 Легендарный! +2000 ⭐');
        }
    } else {
        showToast('🦄 Прогресс: ' + user.petProgress + '/' + threshold + ' ⭐');
    }
    
    closeModal();
    render();
    saveAllData();
    saveToServer();
};

// ============================================================
//  ГЛОБАЛЬНАЯ СИНХРОНИЗАЦИЯ
// ============================================================

let globalData = {
    contest_active: false,
    contest_end_time: null,
    contest_winner: null,
    admin_codes: [],
    reports: [],
    active_chats: {},
    banned_users: {}
};

async function loadGlobalData() {
    try {
        const response = await fetch(SERVER_URL + '/api/get_global_data');
        if (response.ok) {
            globalData = await response.json();
            if (globalData.banned_users) {
                window.bannedUsers = globalData.banned_users;
            }
            render();
            return true;
        }
    } catch(e) {
        console.error('Ошибка загрузки глобальных данных:', e);
    }
    return false;
}

async function syncGlobalData() {
    try {
        await fetch(SERVER_URL + '/api/sync_banned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banned: window.bannedUsers })
        });
        return true;
    } catch(e) { return false; }
}

// ============================================================
//  УВЕДОМЛЕНИЯ
// ============================================================

function addNotification(uid, message, type = 'notification') {
    const user = getUserByUid(uid);
    if (user) {
        if (!user.notifications) user.notifications = [];
        user.notifications.push({
            type: type,
            message: message,
            time: new Date().toLocaleString(),
            read: false
        });
        saveAllData();
        saveToServer();
    }
    showToast(message, 4000);
}

function getUnreadNotifications(uid) {
    const user = getUserByUid(uid);
    if (!user || !user.notifications) return [];
    return user.notifications.filter(n => !n.read);
}

function markNotificationsRead(uid) {
    const user = getUserByUid(uid);
    if (user && user.notifications) {
        user.notifications.forEach(n => n.read = true);
        saveAllData();
        saveToServer();
    }
}

// ============================================================
//  ЧАТ / ПОДДЕРЖКА
// ============================================================

function handleSupport() {
    const user = getCurrentUser();
    const userId = user.uid;

    if (globalData.active_chats && globalData.active_chats[userId]) {
        showChatWindow(userId);
        return;
    }

    openModal('🆘 Жалобы', `
        <p>Опишите вашу проблему:</p>
        <input type="text" id="supportInput" placeholder="Ваше сообщение..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" onclick="sendSupport()">📤 Отправить</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.sendSupport = function() {
    const input = document.getElementById('supportInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('Введите сообщение'); return; }
    const user = getCurrentUser();
    const userId = user.uid;

    fetch(SERVER_URL + '/api/add_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: userId,
            username: user.name || 'No name',
            text: text,
            time: new Date().toLocaleString()
        })
    });

    fetch(SERVER_URL + '/api/add_chat_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: userId,
            message: text,
            sender: 'user',
            time: new Date().toLocaleString()
        })
    });

    // Добавляем уведомление админу
    addNotification('admin', '📩 Новое сообщение от ' + (user.name || userId), 'chat');

    closeModal();
    showToast('Сообщение отправлено администратору!');
    loadGlobalData();
    setTimeout(() => showChatWindow(userId), 500);
};

function showChatWindow(userId) {
    fetch(SERVER_URL + '/api/get_chat/' + userId)
        .then(res => res.json())
        .then(chat => {
            if (!chat || !chat.messages) {
                showToast('Чат не найден');
                return;
            }

            let messagesHtml = '';
            chat.messages.forEach(msg => {
                const cls = msg.from === 'user' ? 'user' : 'admin';
                const label = msg.from === 'user' ? 'Вы' : 'Админ';
                messagesHtml += '<div class="msg ' + cls + '"><strong>' + label + ':</strong> ' + msg.text + '<span class="time">' + msg.time + '</span></div>';
            });

            const isAdmin = chat.admin || false;
            const adminControls = isAdmin ? 
                '<button class="btn danger full" onclick="closeChat(\'' + userId + '\')">🔒 Завершить чат</button>' :
                '<p style="font-size:12px;color:rgba(255,255,255,0.5);">✉️ Ожидайте ответа администратора</p>';

            const user = getUserByUid(userId);
            const name = user ? user.name || userId : userId;

            openModal('💬 Чат с поддержкой (' + name + ')', `
                <div class="chat-container" id="chatContainer">${messagesHtml || '<p style="color:rgba(255,255,255,0.5);text-align:center;">Нет сообщений</p>'}</div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="chatInput" placeholder="Введите сообщение..." style="flex:1;" />
                    <button class="btn primary" onclick="sendChatMessage('${userId}')">📤</button>
                </div>
                ${adminControls}
                <button class="btn full small" onclick="closeModal();">В меню</button>
            `);

            setTimeout(() => {
                const container = document.getElementById('chatContainer');
                if (container) container.scrollTop = container.scrollHeight;
            }, 100);
        });
}

window.sendChatMessage = function(userId) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('Введите сообщение'); return; }

    fetch(SERVER_URL + '/api/add_chat_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: userId,
            message: text,
            sender: 'user',
            time: new Date().toLocaleString()
        })
    });

    // Уведомление админу
    const user = getUserByUid(userId);
    addNotification('admin', '📩 Новое сообщение от ' + (user ? user.name : userId), 'chat');

    showToast('Сообщение отправлено');
    closeModal();
    loadGlobalData();
    setTimeout(() => showChatWindow(userId), 500);
};

window.closeChat = function(uid) {
    fetch(SERVER_URL + '/api/close_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid })
    }).then(() => {
        closeModal();
        showToast('Чат завершён');
        loadGlobalData();
    });
};

// ============================================================
//  АДМИН-ФУНКЦИИ
// ============================================================

window.adminOpenChat = function(uid) {
    fetch(SERVER_URL + '/api/add_chat_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: uid,
            message: 'Администратор подключился к чату',
            sender: 'admin',
            time: new Date().toLocaleString()
        })
    }).then(() => {
        loadGlobalData();
        showAdminChat(uid);
    });
};

window.adminSendMessage = function(uid) {
    const input = document.getElementById('adminChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('Введите сообщение'); return; }

    fetch(SERVER_URL + '/api/add_chat_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: uid,
            message: text,
            sender: 'admin',
            time: new Date().toLocaleString()
        })
    });

    // Уведомление игроку
    const user = getUserByUid(uid);
    addNotification(uid, '📩 Новое сообщение от администратора', 'chat');

    showToast('Сообщение отправлено игроку');
    closeModal();
    loadGlobalData();
    showAdminChat(uid);
};

function showAdminChat(uid) {
    fetch(SERVER_URL + '/api/get_chat/' + uid)
        .then(res => res.json())
        .then(chat => {
            if (!chat || !chat.messages) {
                showToast('Чат не найден');
                return;
            }

            let messagesHtml = '';
            chat.messages.forEach(msg => {
                const cls = msg.from === 'user' ? 'user' : 'admin';
                const label = msg.from === 'user' ? 'Игрок' : 'Админ';
                messagesHtml += '<div class="msg ' + cls + '"><strong>' + label + ':</strong> ' + msg.text + '<span class="time">' + msg.time + '</span></div>';
            });

            const user = getUserByUid(uid);
            const name = user ? user.name || uid : uid;

            openModal('💬 Чат с игроком (' + name + ' | ID: ' + uid + ')', `
                <div class="chat-container" id="adminChatContainer">${messagesHtml || '<p style="color:rgba(255,255,255,0.5);text-align:center;">Нет сообщений</p>'}</div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="adminChatInput" placeholder="Введите сообщение..." style="flex:1;" />
                    <button class="btn primary" onclick="adminSendMessage('${uid}')">📤</button>
                </div>
                <button class="btn danger full" onclick="closeChat('${uid}')">🔒 Завершить чат</button>
                <button class="btn full small" onclick="closeModal();">В меню</button>
            `);

            setTimeout(() => {
                const container = document.getElementById('adminChatContainer');
                if (container) container.scrollTop = container.scrollHeight;
            }, 100);
        });
}

// ============================================================
//  АДМИН-ПАНЕЛЬ (ОБНОВЛЕННАЯ)
// ============================================================

function handleAdmin() {
    openModal('🔧 Админ-панель', `
        <p>Введите пароль:</p>
        <input type="password" id="adminPassword" placeholder="Пароль" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" onclick="adminLogin()">🔑 Войти</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.adminLogin = function() {
    const input = document.getElementById('adminPassword');
    if (!input) return;
    const pass = input.value.trim();
    if (pass !== 'йцфы') { 
        showToast('Неверный пароль'); 
        return; 
    }
    showAdminPanel();
};

function showAdminPanel() {
    // Проверяем непрочитанные сообщения
    const unreadChats = getUnreadNotifications('admin');
    const hasUnread = unreadChats.length > 0;

    let chatNotification = '';
    if (hasUnread) {
        chatNotification = '🔔 <span style="color:#ffd93d;">Новые сообщения (' + unreadChats.length + ')</span>';
    }

    openModal('🔧 Панель управления', `
        <div class="admin-panel">
            <p><strong>👤 Администратор</strong> ${chatNotification}</p>
            <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn small" onclick="adminGenerateCode()">🎫 Создать код</button>
                <button class="btn small" onclick="adminPlayerMenu()">👤 Игроки</button>
                <button class="btn small" onclick="adminTop()">🏆 Топ-30</button>
                <button class="btn small danger" onclick="adminReports()">📩 Жалобы</button>
                <button class="btn small" onclick="adminChats()">💬 Чаты ${hasUnread ? '🔔' : ''}</button>
            </div>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        </div>
    `);
}

// ============================================================
//  АДМИН: КОДЫ
// ============================================================

window.adminGenerateCode = function() {
    const code = generateCode(5);
    
    if (!window.codes) window.codes = {};
    window.codes[code] = {
        used_by: [],
        type: 'attempts',
        created_at: Date.now()
    };
    
    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            code: code, 
            type: 'Код на попытку', 
            target: 'всем',
            max_uses: 999,
            used_by: []
        })
    });
    
    // Отправляем уведомление всем игрокам
    for (const userId in window.users) {
        const user = window.users[userId];
        if (user && user.uid && !user.banned) {
            addNotification(user.uid, '🎫 Новый код: ' + code + ' (используйте в меню "Код")', 'code');
        }
    }
    
    showToast('🎫 Код создан: ' + code);
    loadGlobalData();
    renderAdminCodes();
};

window.applyCode = function() {
    const user = getCurrentUser();
    const input = document.getElementById('codeInput');
    if (!input) return;
    const text = input.value.trim().toUpperCase();
    if (!text) { 
        showToast('Введите код'); 
        return; 
    }
    
    // Проверяем в локальном хранилище
    if (window.codes && window.codes[text]) {
        const codeData = window.codes[text];
        if (codeData.used_by.includes(user.uid)) {
            showToast('Вы уже использовали этот код');
            return;
        }
        
        // Активируем код
        user.attempts = (user.attempts || 0) + 1;
        codeData.used_by.push(user.uid);
        
        // Если все использовали - удаляем код
        const totalUsers = Object.keys(window.users).length;
        if (codeData.used_by.length >= totalUsers) {
            delete window.codes[text];
        }
        
        saveAllData();
        saveToServer();
        closeModal();
        showToast('🎫 Код активирован! +1 попытка');
        render();
        return;
    }
    
    // Проверяем на сервере
    fetch(SERVER_URL + '/api/use_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: text,
            user_id: getUserId(),
            user_uid: user.uid
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || 'Код активирован!');
            closeModal();
            loadFromServer();
            render();
            saveAllData();
        } else {
            showToast(data.message || 'Неверный код');
        }
    })
    .catch(() => {
        showToast('Ошибка сервера');
    });
};

function renderAdminCodes() {
    const panel = document.getElementById('codesPanel');
    const list = document.getElementById('codesList');
    if (!panel || !list) return;
    
    const codes = window.codes || {};
    const codeKeys = Object.keys(codes);
    
    if (codeKeys.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    list.innerHTML = codeKeys.map((code) => {
        const data = codes[code];
        const usedCount = data.used_by ? data.used_by.length : 0;
        return `
            <div class="code-item">
                <span class="code-text" onclick="copyCode('${code}')">${code}</span>
                <span class="code-type">Использовано: ${usedCount}</span>
                <span class="code-delete" onclick="deleteCode('${code}')">✕</span>
            </div>
        `;
    }).join('');
}

window.deleteCode = function(code) {
    if (window.codes && window.codes[code]) {
        delete window.codes[code];
        saveAllData();
        renderAdminCodes();
        showToast('Код удалён');
    }
};

window.copyCode = function(code) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Код скопирован!');
        }).catch(() => {
            fallbackCopyCode(code);
        });
    } else {
        fallbackCopyCode(code);
    }
};

function fallbackCopyCode(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Код скопирован!');
}

// ============================================================
//  АДМИН: ИГРОКИ
// ============================================================

window.adminPlayerMenu = function() {
    openModal('👤 Управление игроком', `
        <p>Введите UID игрока (5 цифр):</p>
        <input type="text" id="playerUidInput" placeholder="UID игрока" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;text-align:center;font-size:20px;" maxlength="5" />
        <button class="btn primary full" onclick="showPlayerInfo()">🔍 Найти</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.showPlayerInfo = function() {
    const input = document.getElementById('playerUidInput');
    if (!input) return;
    const uid = input.value.trim();
    if (!uid || uid.length !== 5 || isNaN(uid)) { 
        showToast('Введите корректный UID (5 цифр)'); 
        return; 
    }
    
    // Загружаем свежие данные
    loadAllUsersFromServer().then(() => {
        const user = getUserByUid(uid);
        if (!user) { 
            showToast('Игрок с таким UID не найден!');
            return;
        }

        const isBanned = user.banned || window.bannedUsers[uid] !== undefined;
        const banReason = user.banned_reason || window.bannedUsers[uid] || '—';
        const name = user.name || '—';
        const gender = user.gender || '—';
        const age = user.age || '—';
        const stars = user.stars || 0;
        const bank = user.bank || 0;
        const attempts = user.attempts || 0;
        const coeff = user.coefficientRate || 0;
        const clickerProgress = user.clickerProgress || 0;
        const regDate = user.registrationDate ? new Date(user.registrationDate).toLocaleDateString() : '—';

        openModal('👤 Игрок: ' + name + ' (' + uid + ')', `
            <p><strong>📊 Статистика:</strong></p>
            <p>👤 Имя: ${name}</p>
            <p>⚧ Пол: ${gender}</p>
            <p>🎂 Возраст: ${age}</p>
            <p>📅 Дата регистрации: ${regDate}</p>
            <p>⭐ Звёзды: <strong style="color:#ffd93d;">${stars}</strong></p>
            <p>🏦 Банк: <strong style="color:#7ed6df;">${bank}</strong></p>
            <p>🎮 Попытки: ${attempts}</p>
            <p>🔥 Коэффициент: +${coeff}</p>
            <p>🦄 Кликер: ${clickerProgress}/400</p>
            <p>🚫 Статус: ${isBanned ? '❌ ЗАБЛОКИРОВАН' : '✅ Активен'}</p>
            ${isBanned ? '<p style="color:#ff4757;">📝 Причина: ' + banReason + '</p>' : ''}
            <hr />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn small" onclick="adminAddStars('${uid}')">⭐ + Звёзды</button>
                <button class="btn small danger" onclick="adminRemoveStars('${uid}')">⭐ - Звёзды</button>
                ${isBanned ? 
                    '<button class="btn small" onclick="adminUnbanUserByUid(\'' + uid + '\')">✅ Разбан</button>' :
                    '<button class="btn small danger" onclick="adminBanUserByUid(\'' + uid + '\')">🚫 Бан</button>'
                }
                <button class="btn small" onclick="adminOpenChat(' + "'" + uid + "'" + ')">💬 Чат</button>
            </div>
            <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
        `);
    });
};

// ============================================================
//  АДМИН: ВЫДАЧА/КОНФИСКАЦИЯ ЗВЕЗД
// ============================================================

window.adminAddStars = function(uid) {
    openModal('⭐ Добавить звёзды игроку', `
        <p>UID: <strong>${uid}</strong></p>
        <input type="number" id="addStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" onclick="doAddStars('${uid}')">✅ Добавить</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doAddStars = async function(uid) {
    const input = document.getElementById('addStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    
    const user = getUserByUid(uid);
    if (!user) { showToast('Игрок не найден'); return; }
    
    user.stars = (user.stars || 0) + amount;
    addNotification(uid, '⭐ Администратор начислил вам ' + amount + ' звёзд', 'admin_action');
    
    saveAllData();
    saveToServer();
    loadAllUsersFromServer();
    render();
    showToast('+' + amount + ' звёзд игроку ' + uid);
    closeModal();
    setTimeout(() => showPlayerInfo(), 500);
};

window.adminRemoveStars = function(uid) {
    openModal('⭐ Забрать звёзды у игрока', `
        <p>UID: <strong>${uid}</strong></p>
        <input type="number" id="removeStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn danger full" onclick="doRemoveStars('${uid}')">✅ Забрать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doRemoveStars = async function(uid) {
    const input = document.getElementById('removeStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    
    const user = getUserByUid(uid);
    if (!user) { showToast('Игрок не найден'); return; }
    
    if ((user.stars || 0) < amount) {
        showToast('Недостаточно звёзд у игрока!');
        return;
    }
    
    user.stars = (user.stars || 0) - amount;
    addNotification(uid, '⭐ Администратор забрал у вас ' + amount + ' звёзд', 'admin_action');
    
    saveAllData();
    saveToServer();
    loadAllUsersFromServer();
    render();
    showToast('-' + amount + ' звёзд у игрока ' + uid);
    closeModal();
    setTimeout(() => showPlayerInfo(), 500);
};

// ============================================================
//  АДМИН: БАН / РАЗБАН
// ============================================================

window.adminBanUserByUid = function(uid) {
    openModal('🚫 Блокировка игрока', `
        <p>UID: <strong>${uid}</strong></p>
        <p>Введите причину блокировки:</p>
        <input type="text" id="banReasonInput" placeholder="Причина блокировки..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn danger full" onclick="doBanUser('${uid}')">🚫 Заблокировать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doBanUser = async function(uid) {
    const input = document.getElementById('banReasonInput');
    if (!input) return;
    const reason = input.value.trim() || 'Нарушение правил';
    
    window.bannedUsers[uid] = reason;
    const user = getUserByUid(uid);
    if (user) {
        user.banned = true;
        user.banned_reason = reason;
        // Блокируем все кнопки, кроме поддержки
        addNotification(uid, '🚫 Вас заблокировали. Причина: ' + reason, 'ban');
    }
    saveAllData();
    await syncGlobalData();
    showToast(uid + ' заблокирован. Причина: ' + reason);
    closeModal();
    render();
    saveAllData();
    setTimeout(() => showPlayerInfo(), 500);
};

window.adminUnbanUserByUid = async function(uid) {
    if (window.bannedUsers[uid]) {
        delete window.bannedUsers[uid];
        const user = getUserByUid(uid);
        if (user) {
            user.banned = false;
            user.banned_reason = '';
            addNotification(uid, '✅ Вас разблокировали!', 'admin_action');
        }
        saveAllData();
        await syncGlobalData();
        showToast(uid + ' разблокирован');
        closeModal();
        render();
        saveAllData();
        setTimeout(() => showPlayerInfo(), 500);
    }
};

// ============================================================
//  АДМИН: ЖАЛОБЫ И ЧАТЫ
// ============================================================

window.adminReports = function() {
    if (!globalData.reports || globalData.reports.length === 0) {
        showToast('📭 Жалоб пока нет');
        return;
    }

    let text = '📩 Жалобы:\n\n';
    const last = globalData.reports.slice(-10);
    for (const r of last) {
        text += 'От ' + r.username + ' (ID: ' + r.uid + ') [' + r.time + ']:\n' + r.text + '\n\n';
    }

    openModal('📩 Жалобы', `
        <div class="scrollable"><pre style="color:#c0c0e0;font-family:inherit;white-space:pre-wrap;font-size:14px;">${text}</pre></div>
        <button class="btn danger full" onclick="fetch('${SERVER_URL}/api/clear_reports', {method:'POST'}); globalData.reports=[]; closeModal(); showToast('Жалобы очищены'); showAdminPanel();">🗑️ Очистить жалобы</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.adminChats = function() {
    const unreadChats = getUnreadNotifications('admin');
    markNotificationsRead('admin');
    
    if (!globalData.active_chats || Object.keys(globalData.active_chats).length === 0) {
        showToast('💬 Активных чатов нет');
        return;
    }

    let chatButtons = '<p><strong>Активные чаты:</strong></p><div style="display:flex;flex-wrap:wrap;gap:4px;">';
    for (const uid in globalData.active_chats) {
        const user = getUserByUid(uid);
        const name = user ? user.name || uid : uid;
        const hasUnread = unreadChats.some(n => n.message.includes(uid));
        chatButtons += '<button class="btn small" onclick="adminOpenChat(\'' + uid + '\')" style="margin:2px;">💬 ' + name + (hasUnread ? ' 🔔' : '') + '</button>';
    }
    chatButtons += '</div>';

    openModal('💬 Чаты', `
        ${chatButtons}
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

// ============================================================
//  АДМИН: ТОП-30
// ============================================================

window.adminTop = function() {
    loadAllUsersFromServer().then(() => {
        const usersList = getAllUsersList();
        let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>UID</th><th>Имя</th><th>⭐</th></tr></thead><tbody>';
        const sorted = usersList
            .filter(u => !u.banned)
            .sort((a, b) => (b.stars || 0) - (a.stars || 0))
            .slice(0, 30);
        if (sorted.length === 0) {
            html += '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.5);">Нет игроков</td></tr>';
        }
        sorted.forEach((item, i) => {
            html += '<tr><td>' + (i+1) + '</td><td>' + item.uid + '</td><td>' + item.name + '</td><td>' + item.stars + '</td></tr>';
        });
        html += '</tbody></table><button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>';
        openModal('🏆 Топ-30', html);
    });
};

// ============================================================
//  КОЛЕСО УДАЧИ (НЕ ТРОГАЕМ)
// ============================================================

const SEGMENTS = [
    { label: 'Ничего', icon: '😔', value: 0 },
    { label: '10 ⭐', icon: '⭐', value: 10 },
    { label: '25 ⭐', icon: '⭐', value: 25 },
    { label: '50 ⭐', icon: '⭐', value: 50 },
    { label: '100 ⭐', icon: '⭐', value: 100 },
    { label: '150 ⭐', icon: '🌟', value: 150 },
    { label: '200 ⭐', icon: '🌟', value: 200 },
    { label: '300 ⭐', icon: '💎', value: 300 },
    { label: '500 ⭐', icon: '💎', value: 500 },
    { label: '1000 ⭐', icon: '👑', value: 1000 }
];

let wheelCtx = null;
let wheelSegments = [];
let currentAngle = 0;
let isSpinning = false;
let winIndex = 0;

function initWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    wheelCtx = canvas.getContext('2d');
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    drawWheel();
}

function drawWheel(highlightIndex = -1) {
    if (!wheelCtx || !document.getElementById('wheelCanvas')) return;
    const canvas = document.getElementById('wheelCanvas');
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2 - 10;
    const segCount = wheelSegments.length;
    const angleStep = (2 * Math.PI) / segCount;

    wheelCtx.clearRect(0, 0, w, h);

    for (let i = 0; i < segCount; i++) {
        const startAngle = currentAngle + i * angleStep;
        const endAngle = startAngle + angleStep;

        wheelCtx.beginPath();
        wheelCtx.moveTo(centerX, centerY);
        wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        wheelCtx.closePath();

        const isHighlight = (i === highlightIndex);
        if (isHighlight) {
            wheelCtx.shadowColor = 'rgba(255, 217, 61, 0.8)';
            wheelCtx.shadowBlur = 30;
            wheelCtx.fillStyle = '#ffd93d';
            wheelCtx.fill();
            wheelCtx.shadowBlur = 0;
            wheelCtx.strokeStyle = 'rgba(255, 217, 61, 0.6)';
            wheelCtx.lineWidth = 4;
            wheelCtx.stroke();
        } else {
            wheelCtx.fillStyle = 'rgba(255,255,255,0.1)';
            wheelCtx.fill();
            wheelCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            wheelCtx.lineWidth = 1;
            wheelCtx.stroke();
        }

        const midAngle = startAngle + angleStep / 2;
        const textRadius = radius * 0.65;
        const x = centerX + Math.cos(midAngle) * textRadius;
        const y = centerY + Math.sin(midAngle) * textRadius;

        wheelCtx.save();
        wheelCtx.translate(x, y);
        wheelCtx.rotate(midAngle + (midAngle > Math.PI/2 ? Math.PI : 0));

        wheelCtx.textAlign = 'center';
        wheelCtx.textBaseline = 'middle';

        if (isHighlight) {
            wheelCtx.shadowColor = 'rgba(255, 217, 61, 0.5)';
            wheelCtx.shadowBlur = 15;
        } else {
            wheelCtx.shadowBlur = 0;
        }

        wheelCtx.font = '20px Segoe UI, sans-serif';
        wheelCtx.fillStyle = isHighlight ? '#1a1a2e' : 'rgba(255,255,255,0.6)';
        wheelCtx.fillText(wheelSegments[i].icon, 0, -10);

        wheelCtx.font = '9px Segoe UI, sans-serif';
        if (wheelSegments[i].value > 0) {
            wheelCtx.fillStyle = isHighlight ? '#1a1a2e' : 'rgba(255,255,255,0.4)';
            wheelCtx.fillText(wheelSegments[i].value + '⭐', 0, 16);
        } else {
            wheelCtx.fillStyle = isHighlight ? '#1a1a2e' : 'rgba(255,255,255,0.2)';
            wheelCtx.fillText('—', 0, 16);
        }

        wheelCtx.restore();
    }

    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    wheelCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    wheelCtx.lineWidth = 2;
    wheelCtx.stroke();
}

function spinWheel() {
    if (isSpinning) return;
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('Сначала зарегистрируйтесь!');
        return;
    }
    if (user.banned) {
        showToast('Вы заблокированы');
        return;
    }
    if (user.attempts <= 0) {
        showToast('Попыток нет! Купите в меню или подождите час.');
        return;
    }

    isSpinning = true;
    document.getElementById('wheelSpinBtn').disabled = true;
    document.getElementById('wheelResult').textContent = '🔄 Крутим...';

    user.attempts--;

    const roll = Math.random() * 100;
    if (roll < 60) winIndex = 0;
    else if (roll < 68) winIndex = 1;
    else if (roll < 75) winIndex = 2;
    else if (roll < 81) winIndex = 3;
    else if (roll < 86) winIndex = 4;
    else if (roll < 90) winIndex = 5;
    else if (roll < 94) winIndex = 6;
    else if (roll < 97) winIndex = 7;
    else if (roll < 99.3) winIndex = 8;
    else winIndex = 9;

    const segCount = wheelSegments.length;
    const angleStep = (2 * Math.PI) / segCount;
    const targetSegmentCenter = Math.PI / 2 - (winIndex * angleStep + angleStep / 2);
    const extraSpins = 3 + Math.random() * 2;
    const targetAngle = targetSegmentCenter + extraSpins * 2 * Math.PI;

    const totalSteps = 120;
    let step = 0;
    const startAngle = currentAngle;

    const spinInterval = setInterval(() => {
        step++;
        const progress = step / totalSteps;
        const eased = 1 - Math.pow(1 - progress, 3);
        currentAngle = startAngle + (targetAngle - startAngle) * eased;
        drawWheel(step === totalSteps ? winIndex : -1);

        if (step >= totalSteps) {
            clearInterval(spinInterval);
            currentAngle = targetAngle;
            drawWheel(winIndex);
            const result = wheelSegments[winIndex];
            showWheelResult(result, user);
            isSpinning = false;
            document.getElementById('wheelSpinBtn').disabled = false;
            render();
            saveAllData();
            saveToServer();
        }
    }, 30);
}

function showWheelResult(result, user) {
    const resultDiv = document.getElementById('wheelResult');
    const coeff = user.coefficientRate || 0;

    if (result.value === 0) {
        resultDiv.innerHTML = '😔 Ничего не выиграно!';
        showToast('😔 Ничего не выиграно');
        return;
    }

    let finalValue = result.value;
    if (coeff > 0) finalValue = Math.round(result.value + coeff);

    user.stars += finalValue;
    resultDiv.innerHTML = '🎉 +' + finalValue + ' ⭐ (' + result.label + ')';
    showToast('🎉 +' + finalValue + ' ⭐');
    render();
    saveAllData();
    saveToServer();
}

function openWheel() {
    document.getElementById('wheelOverlay').classList.add('active');
    document.getElementById('wheelResult').textContent = 'Нажмите "Крутить"!';
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    currentAngle = 0;
    drawWheel();
    const user = getCurrentUser();
    document.getElementById('wheelAttemptsCount').textContent = user.attempts || 0;
}

function closeWheel() {
    document.getElementById('wheelOverlay').classList.remove('active');
}

// ============================================================
//  БАНК
// ============================================================

function handleBank() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('Сначала зарегистрируйтесь!');
        return;
    }
    if (user.banned) {
        showToast('Вы заблокированы');
        return;
    }
    
    processBank();
    
    const bank = user.bank || 0;
    const deposit = user.bankDeposit || 0;
    
    if (bank > 0) {
        openModal('🏦 Банк (10⭐/мин)', `
            <p>💰 В банке: <strong style="color:#ffd93d;">${bank}</strong> ⭐</p>
            <p>📊 Первоначальный вклад: <strong style="color:#7ed6df;">${deposit}</strong> ⭐</p>
            <p>📈 Ставка: <strong style="color:#ffd93d;">10 ⭐ в минуту</strong></p>
            <p style="font-size:12px;color:rgba(255,255,255,0.5);">⏱ Доход начисляется автоматически</p>
            <button class="btn primary full" onclick="withdrawBank()">💰 Забрать все ⭐</button>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        `);
    } else {
        openModal('🏦 Банк (10⭐/мин)', `
            <p>Банк пуст.</p>
            <p>📈 Ставка: <strong style="color:#ffd93d;">10 ⭐ в минуту</strong></p>
            <p style="font-size:12px;color:rgba(255,255,255,0.5);">💡 Положите звёзды и они будут расти!</p>
            <input type="number" id="bankDepositInput" placeholder="Сумма для вклада" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
            <button class="btn primary full" onclick="depositBank()">💵 Положить в банк</button>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        `);
    }
}

window.withdrawBank = function() {
    const user = getCurrentUser();
    processBank();
    
    const amount = user.bank || 0;
    if (amount <= 0) { showToast('Банк пуст'); return; }
    user.stars += amount;
    user.bank = 0;
    user.bankDeposit = 0;
    user.bankTime = Date.now();
    closeModal();
    showToast('Забрано ' + amount + ' ⭐ из банка');
    render();
    saveAllData();
    saveToServer();
};

window.depositBank = function() {
    const user = getCurrentUser();
    const input = document.getElementById('bankDepositInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    if (user.stars < amount) { showToast('Недостаточно звёзд'); return; }
    user.stars -= amount;
    user.bank = amount;
    user.bankDeposit = amount;
    user.bankTime = Date.now();
    closeModal();
    showToast(amount + ' ⭐ положены в банк под 10⭐/мин');
    render();
    saveAllData();
    saveToServer();
};

// ============================================================
//  ОСТАЛЬНЫЕ ИГРОВЫЕ ФУНКЦИИ
// ============================================================

function handlePlay() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('Сначала зарегистрируйтесь!');
        return;
    }
    if (user.banned) {
        showToast('Вы заблокированы. Причина: ' + (user.banned_reason || 'Нарушение правил'));
        return;
    }
    if (user.attempts <= 0) {
        showToast('Попыток нет! Купите в меню или подождите час.');
        return;
    }
    openWheel();
}

function handleClicker() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('Сначала зарегистрируйтесь!');
        return;
    }
    if (user.banned) {
        showToast('Вы заблокированы');
        return;
    }
    const progress = user.clickerProgress || 0;
    const remaining = 400 - progress;
    const reward = 20;

    openModal('⭐ Кликер звёзд', `
        <div style="text-align:center;">
            <div class="clicker-star" id="clickerStar" onclick="clickStar()">⭐</div>
            <div class="clicker-stats">
                <span>Прогресс: <strong id="clickerProgress">${progress}</strong> / 400</span>
                <span>Награда: <strong id="clickerReward">${reward}</strong> ⭐</span>
            </div>
            <div class="clicker-progress">
                <div class="fill" id="clickerFill" style="width: ${(progress/400)*100}%;"></div>
            </div>
            <p style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:8px;">
                ${remaining > 0 ? 'Осталось кликов: ' + remaining : '🎉 Готово! Заберите награду!'}
            </p>
            ${progress >= 400 ? '<button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать ' + reward + ' ⭐</button>' : ''}
            <button class="btn full small" onclick="closeModal();">В меню</button>
        </div>
    `);
}

window.clickStar = function() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) return;
    if (user.clickerProgress >= 400) {
        showToast('Вы уже накликали 400 раз! Заберите награду!');
        return;
    }
    user.clickerProgress = (user.clickerProgress || 0) + 1;
    const progress = user.clickerProgress;
    const star = document.getElementById('clickerStar');
    if (star) {
        star.classList.remove('pop');
        void star.offsetWidth;
        star.classList.add('pop');
    }
    const progressEl = document.getElementById('clickerProgress');
    const fillEl = document.getElementById('clickerFill');
    if (progressEl) progressEl.textContent = progress;
    if (fillEl) fillEl.style.width = (progress/400)*100 + '%';
    const remaining = 400 - progress;
    const infoP = document.querySelector('.clicker-stats + p');
    if (infoP) {
        infoP.textContent = remaining > 0 ? 'Осталось кликов: ' + remaining : '🎉 Готово! Заберите награду!';
    }
    if (progress >= 400) {
        const btn = document.querySelector('button[onclick="claimClickerReward()"]');
        if (!btn) {
            const container = document.querySelector('.clicker-stats + p');
            if (container) {
                container.innerHTML = '<button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать 20 ⭐</button>';
            }
        }
        showToast('🎉 400 кликов! Заберите награду!');
    }
    render();
    saveAllData();
    saveToServer();
};

window.claimClickerReward = function() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) return;
    if (user.clickerProgress < 400) {
        showToast('Нужно накликать 400 раз!');
        return;
    }
    user.stars += 20;
    user.clickerProgress = 0;
    closeModal();
    showToast('+20 ⭐ за клики!');
    render();
    saveAllData();
    saveToServer();
};

function handleBuy() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    openModal('🛒 Покупка попыток', `
        <p>Ваш баланс: <strong style="color:#ffd93d;">${user.stars}</strong> ⭐</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.5);">⏰ +1 попытка каждый час бесплатно!</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn" onclick="buyAttempts(1, 100)" style="flex:1;background:linear-gradient(135deg,#ff6b9d,#ff2e63);">1 попытка — 100⭐</button>
            <button class="btn" onclick="buyAttempts(2, 180)" style="flex:1;background:linear-gradient(135deg,#a29bfe,#6c5ce7);">2 — 180⭐</button>
            <button class="btn" onclick="buyAttempts(4, 340)" style="flex:1;background:linear-gradient(135deg,#ffd93d,#f0932b);">4 — 340⭐</button>
        </div>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.buyAttempts = function(count, price) {
    const user = getCurrentUser();
    if (user.stars < price) { showToast('Недостаточно звёзд'); return; }
    user.stars -= price;
    user.attempts += count;
    closeModal();
    showToast('Куплено ' + count + ' попыток');
    render();
    saveAllData();
    saveToServer();
};

function handleCode() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    openModal('🎫 Ввести код', `
        <p>Введите код для активации бонуса:</p>
        <input type="text" id="codeInput" placeholder="Код" style="text-transform:uppercase;width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" maxlength="5" />
        <button class="btn primary full" onclick="applyCode()">✅ Активировать</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

function handleLeaderboard() {
    loadAllUsersFromServer().then(() => {
        const usersList = getAllUsersList();
        let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>UID</th><th>Имя</th><th>⭐</th></tr></thead><tbody>';
        const sorted = usersList
            .filter(u => !u.banned)
            .sort((a, b) => (b.stars || 0) - (a.stars || 0))
            .slice(0, 30);
        if (sorted.length === 0) {
            html += '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.5);">Нет игроков</td></tr>';
        }
        sorted.forEach((item, i) => {
            html += '<tr><td>' + (i+1) + '</td><td>' + item.uid + '</td><td>' + item.name + '</td><td>' + item.stars + '</td></tr>';
        });
        html += '</tbody></table><button class="btn full small" onclick="closeModal();">В меню</button>';
        openModal('🏆 Таблица лидеров', html);
    });
}

function handleRules() {
    openModal('📜 Правила', `
        <div class="scrollable">
            <p><strong>🎰 Колесо удачи</strong></p>
            <p>• 1 сектор "Ничего" (60% шанс)</p>
            <p>• 9 призовых секторов (40% шанс)</p>
            <p>• Призы: 10⭐, 25⭐, 50⭐, 100⭐, 150⭐, 200⭐, 300⭐, 500⭐, 1000⭐</p>
            <br>
            <p><strong>🏦 Банк</strong></p>
            <p>• 10 ⭐ в минуту от первоначальной суммы</p>
            <br>
            <p><strong>⭐ Кликер</strong></p>
            <p>• 400 кликов → +20 ⭐</p>
            <br>
            <p><strong>🦄 Питомец</strong></p>
            <p>• Растёт от кормления звёздами</p>
            <p>• Приносит пассивный доход (⭐/час)</p>
            <br>
            <p><strong>🎫 Коды</strong></p>
            <p>• Вводите 5-значные коды для бонусов</p>
            <br>
            <p><strong>⏰ Попытки</strong></p>
            <p>• Стартовые: 10 попыток</p>
            <p>• +1 попытка каждый час бесплатно</p>
            <br>
            <p><strong>👑 Администратор всегда прав!</strong></p>
        </div>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

// ============================================================
//  РЕГИСТРАЦИЯ (ОБНОВЛЕННАЯ)
// ============================================================

function showRegistration() {
    const user = getCurrentUser();
    // Генерируем новый UID
    let newUid = generateNewUid();
    // Проверяем, что такой UID не занят
    while (window.uidMap[newUid]) {
        newUid = generateNewUid();
    }
    user.uid = newUid;
    window.uidMap[newUid] = getUserId();
    saveAllData();
    
    openModal('📝 Регистрация', `
        <p>🦄 Добро пожаловать в розовую сказку!</p>
        <p>Ваш уникальный ID: <strong style="color:#ffd93d;font-size:24px;">${newUid}</strong></p>
        <p style="font-size:12px;color:rgba(255,255,255,0.5);">(скопируйте его, он понадобится для входа)</p>
        <p>Введите ваше имя:</p>
        <input type="text" id="regName" placeholder="Имя" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <p>Выберите пол:</p>
        <div style="display:flex;gap:8px;margin:5px 0;">
            <button class="btn" onclick="selectGender('Мужской')" style="flex:1;background:linear-gradient(135deg,#6c5ce7,#a29bfe);">👨 Мужской</button>
            <button class="btn" onclick="selectGender('Женский')" style="flex:1;background:linear-gradient(135deg,#ff6b9d,#fd79a8);">👩 Женский</button>
        </div>
        <p>Введите возраст:</p>
        <input type="number" id="regAge" placeholder="Возраст" min="1" max="120" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff;" />
        <button class="btn primary full" id="regCompleteBtn" onclick="completeRegistration()" disabled>✅ Завершить</button>
    `);
}

let regData = { name: '', gender: '', age: '' };
let genderSelected = false;

window.selectGender = function(g) {
    genderSelected = true;
    regData.gender = g;
    showToast('Пол: ' + g);
    checkRegistrationReady();
};

function checkRegistrationReady() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
    const btn = document.getElementById('regCompleteBtn');
    if (nameInput && ageInput && btn) {
        const name = nameInput.value.trim();
        const age = parseInt(ageInput.value);
        if (name.length > 0 && age > 0 && age <= 120 && genderSelected) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    }
}

// Добавляем обработчики для проверки ввода
document.addEventListener('DOMContentLoaded', function() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
    if (nameInput) nameInput.addEventListener('input', checkRegistrationReady);
    if (ageInput) ageInput.addEventListener('input', checkRegistrationReady);
});

window.completeRegistration = function() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
    if (!nameInput || !ageInput) return;
    
    regData.name = nameInput.value.trim();
    regData.age = parseInt(ageInput.value);

    if (!regData.name || regData.name.length === 0) {
        showToast('Введите имя');
        return;
    }
    if (!regData.age || regData.age < 1 || regData.age > 120) {
        showToast('Введите возраст от 1 до 120');
        return;
    }
    if (!regData.gender) {
        showToast('Выберите пол');
        return;
    }

    const user = getCurrentUser();
    user.name = regData.name;
    user.gender = regData.gender;
    user.age = regData.age;
    user.registered = true;
    user.registrationDate = new Date().toISOString();
    user.attempts = 10;
    user.stars = 300;
    
    closeModal();
    showToast('🎉 Регистрация завершена! Ваш ID: ' + user.uid);
    render();
    saveAllData();
    saveToServer();
};

function checkRegistration() {
    const user = getCurrentUser();
    if (!user.registered) {
        showRegistration();
    } else if (!user.uid || !window.uidMap[user.uid]) {
        // Если UID потерялся - восстанавливаем
        const newUid = generateNewUid();
        user.uid = newUid;
        window.uidMap[newUid] = getUserId();
        saveAllData();
        render();
    }
}

// ============================================================
//  TOAST И МОДАЛКА
// ============================================================

let toastTimeout;

function showToast(text, duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
}

function openModal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ============================================================
//  ОСТАЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function saveToServer() {
    try {
        const user = getCurrentUser();
        const userId = getUserId();
        if (!user || !user.uid || !user.registered) return false;
        
        await fetch(SERVER_URL + '/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, user_data: user })
        });
        return true;
    } catch(e) { return false; }
}

async function loadFromServer() {
    try {
        const userId = getUserId();
        const response = await fetch(SERVER_URL + '/api/load/' + userId);
        if (response.ok) {
            const data = await response.json();
            const user = getCurrentUser();
            const oldUid = user.uid;
            Object.assign(user, data);
            user.uid = oldUid;
            if (user.uid) {
                window.uidMap[user.uid] = userId;
            }
            render();
            saveAllData();
            return true;
        }
    } catch(e) {}
    return false;
}

async function loadAllUsersFromServer() {
    try {
        const response = await fetch(SERVER_URL + '/api/all_users');
        if (response.ok) {
            const data = await response.json();
            for (const item of data) {
                if (item.uid) {
                    const user = getUser(item.user_id || item.uid);
                    if (user) {
                        user.name = item.name || user.name;
                        user.stars = item.stars || user.stars;
                        user.bank = item.bank || user.bank;
                        user.attempts = item.attempts || user.attempts;
                        user.registered = item.registered || user.registered;
                        user.uid = item.uid;
                        user.banned = item.banned || false;
                        user.banned_reason = item.banned_reason || '';
                        window.uidMap[item.uid] = item.user_id || item.uid;
                    }
                }
            }
            saveAllData();
            return data;
        }
    } catch(e) {}
    return [];
}

// ============================================================
//  ОТРИСОВКА
// ============================================================

function render() {
    const user = getCurrentUser();
    if (!user) return;
    
    const nameEl = document.getElementById('userName');
    const genderEl = document.getElementById('userGender');
    const ageEl = document.getElementById('userAge');
    const uidEl = document.getElementById('userUid');
    const attemptsEl = document.getElementById('userAttempts');
    const starsEl = document.getElementById('starsBalance');
    const bankEl = document.getElementById('bankBalance');
    const statusEl = document.getElementById('userRegStatus');
    const petStageEl = document.getElementById('petStage');
    const petProgressEl = document.getElementById('petProgress');
    
    if (nameEl) nameEl.textContent = user.name || '—';
    if (genderEl) genderEl.textContent = user.gender || '—';
    if (ageEl) ageEl.textContent = user.age || '—';
    if (uidEl) uidEl.textContent = user.uid || '—';
    if (attemptsEl) attemptsEl.textContent = user.attempts || 0;
    if (starsEl) starsEl.textContent = user.stars || 0;
    if (bankEl) bankEl.textContent = user.bank || 0;
    
    if (statusEl) {
        if (user.banned) {
            statusEl.textContent = '🚫 ЗАБЛОКИРОВАН: ' + (user.banned_reason || 'Нарушение правил');
            statusEl.style.color = '#ff4757';
            // Блокируем все кнопки кроме поддержки
            document.querySelectorAll('.btn-grid .btn').forEach(btn => {
                if (btn.id !== 'btnSupport') {
                    btn.style.opacity = '0.3';
                    btn.style.pointerEvents = 'none';
                }
            });
        } else {
            document.querySelectorAll('.btn-grid .btn').forEach(btn => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
            if (user.registered) {
                statusEl.textContent = '✅ Зарегистрирован (ID: ' + (user.uid || '—') + ')';
                statusEl.style.color = '#4caf50';
            } else {
                statusEl.textContent = '❌ Не зарегистрирован';
                statusEl.style.color = '#ff4757';
            }
        }
    }
    
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const thresholds = { 1: 100, 2: 500, 3: 1500, 4: 3000 };
    const threshold = thresholds[stage] || 0;
    const stageNames = { 1: '🦄 Малыш', 2: '🦄 Подросток', 3: '🦄 Взрослый', 4: '🦄 Легендарный' };
    if (petStageEl) petStageEl.textContent = stageNames[stage] || '🦄 Малыш';
    if (petProgressEl) petProgressEl.textContent = progress + ' / ' + threshold + ' ⭐';
    
    // Проверяем непрочитанные уведомления
    const unread = getUnreadNotifications(user.uid);
    if (unread.length > 0) {
        // Показываем первое непрочитанное уведомление
        const notif = unread[0];
        showToast('🔔 ' + notif.message, 5000);
        // Отмечаем как прочитанное
        notif.read = true;
        saveAllData();
        saveToServer();
    }
    
    renderAdminCodes();
    renderContest();
    
    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;
}

function renderContest() {
    const banner = document.getElementById('contestBanner');
    if (!banner) return;
    if (!globalData.contest_active) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';
    const now = Date.now();
    const remaining = globalData.contest_end_time - now;
    if (remaining <= 0) { 
        endContest(); 
        return; 
    }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    banner.innerHTML = `
        <div class="title">🏆 КОНКУРС</div>
        <div class="timer">${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);">Победит тот, у кого больше звёзд (баланс + банк)</div>
    `;
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

console.log('🦄 game.js v2.0 загружен, инициализация...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

function initGame() {
    console.log('DOM загружен, инициализация игры...');
    
    const btnPlay = document.getElementById('btnPlay');
    const btnBank = document.getElementById('btnBank');
    const btnClicker = document.getElementById('btnClicker');
    const btnCoeff = document.getElementById('btnCoeff');
    const btnPet = document.getElementById('btnPet');
    const btnBuy = document.getElementById('btnBuy');
    const btnCode = document.getElementById('btnCode');
    const btnLeaderboard = document.getElementById('btnLeaderboard');
    const btnRules = document.getElementById('btnRules');
    const btnSupport = document.getElementById('btnSupport');
    const btnAdmin = document.getElementById('btnAdmin');
    const wheelSpinBtn = document.getElementById('wheelSpinBtn');
    const wheelCloseBtn = document.getElementById('wheelCloseBtn');
    const wheelCanvas = document.getElementById('wheelCanvas');
    
    if (btnPlay) btnPlay.addEventListener('click', handlePlay);
    if (btnBank) btnBank.addEventListener('click', handleBank);
    if (btnClicker) btnClicker.addEventListener('click', handleClicker);
    if (btnCoeff) btnCoeff.addEventListener('click', handleCoeff);
    if (btnPet) btnPet.addEventListener('click', handlePet);
    if (btnBuy) btnBuy.addEventListener('click', handleBuy);
    if (btnCode) btnCode.addEventListener('click', handleCode);
    if (btnLeaderboard) btnLeaderboard.addEventListener('click', handleLeaderboard);
    if (btnRules) btnRules.addEventListener('click', handleRules);
    if (btnSupport) btnSupport.addEventListener('click', handleSupport);
    if (btnAdmin) btnAdmin.addEventListener('click', handleAdmin);
    
    if (wheelSpinBtn) wheelSpinBtn.addEventListener('click', spinWheel);
    if (wheelCloseBtn) wheelCloseBtn.addEventListener('click', closeWheel);
    if (wheelCanvas) wheelCanvas.addEventListener('click', spinWheel);
    
    render();
    initWheel();
    
    setTimeout(async function() {
        await loadGlobalData();
        await loadFromServer();
        await loadAllUsersFromServer();
        setTimeout(checkRegistration, 500);
        render();
    }, 500);
    
    console.log('🦄 Все обработчики назначены!');
}

setInterval(() => {
    const user = getCurrentUser();
    if (user.registered) {
        saveToServer();
    }
}, 15000);

setInterval(saveAllData, 30000);

setInterval(() => {
    loadGlobalData();
    render();
}, 5000);

console.log('🦄 Забава Игра v2.0 готова!');
