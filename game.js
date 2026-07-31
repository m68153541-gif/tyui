console.log('🚀 Игра загружается...');

// ============================================================
//  ID
// ============================================================

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
window.oneTimeCodes = window.oneTimeCodes || new Set();
window.multiUseCodes = window.multiUseCodes || {};
window.boosterCodes = window.boosterCodes || new Set();
window.boosterMultiCodes = window.boosterMultiCodes || {};

const SERVER_URL = window.location.origin;

// Переменная для синхронизации
let lastSyncTimestamp = 0;

function saveAllData() {
    try {
        const data = {
            users: window.users,
            uidMap: window.uidMap,
            oneTimeCodes: Array.from(window.oneTimeCodes || []),
            multiUseCodes: window.multiUseCodes,
            boosterCodes: Array.from(window.boosterCodes || []),
            boosterMultiCodes: window.boosterMultiCodes
        };
        localStorage.setItem('zabava_game_full_data', JSON.stringify(data));
        return true;
    } catch(e) { return false; }
}

function loadAllData() {
    try {
        const data = localStorage.getItem('zabava_game_full_data');
        if (data) {
            const parsed = JSON.parse(data);
            window.users = parsed.users || {};
            window.uidMap = parsed.uidMap || {};
            window.oneTimeCodes = new Set(parsed.oneTimeCodes || []);
            window.multiUseCodes = parsed.multiUseCodes || {};
            window.boosterCodes = new Set(parsed.boosterCodes || []);
            window.boosterMultiCodes = parsed.boosterMultiCodes || {};
            return true;
        }
    } catch(e) {}
    return false;
}

loadAllData();

// ============================================================
//  ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function generateUid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let uid = '';
    for (let i = 0; i < 6; i++) uid += chars[Math.floor(Math.random() * chars.length)];
    return uid;
}

function generateThreeUids() {
    const uids = [];
    const used = new Set();
    while (uids.length < 3) {
        const uid = generateUid();
        if (!used.has(uid) && !window.uidMap[uid]) {
            used.add(uid);
            uids.push(uid);
        }
    }
    return uids;
}

function generateCode(len = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getUser(userId) {
    if (!window.users[userId]) {
        window.users[userId] = {
            username: null,
            attempts: 1,
            wins: [],
            boosted: false,
            stars: 300,
            petProgress: 0,
            uid: null,
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
            banned_reason: ''
        };
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

// ===== НОВАЯ ФУНКЦИЯ СИНХРОНИЗАЦИИ С СЕРВЕРОМ =====
async function syncWithServer() {
    try {
        const response = await fetch(SERVER_URL + '/api/check_updates?timestamp=' + lastSyncTimestamp);
        if (response.ok) {
            const data = await response.json();
            if (data.has_updates) {
                if (data.global_data) {
                    window.globalData = data.global_data;
                    if (data.global_data.banned_users) {
                        window.bannedUsers = data.global_data.banned_users;
                    }
                }
                
                const user = getCurrentUser();
                if (user && user.uid) {
                    await loadFromServer();
                }
                
                await checkNotifications();
                render();
                lastSyncTimestamp = data.timestamp;
            }
        }
    } catch(e) {
        console.error('Ошибка синхронизации:', e);
    }
}

// ===== ФУНКЦИЯ ПРОВЕРКИ УВЕДОМЛЕНИЙ =====
async function checkNotifications() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;
    
    try {
        const response = await fetch(SERVER_URL + '/api/get_notifications/' + user.uid);
        if (response.ok) {
            const data = await response.json();
            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(function(notification, index) {
                    setTimeout(function() {
                        showToast(notification.message);
                    }, index * 3000);
                });
                
                const banNotification = data.notifications.find(function(n) { 
                    return n.type === 'ban'; 
                });
                if (banNotification) {
                    user.banned = true;
                    user.banned_reason = banNotification.message;
                    render();
                }
            }
        }
    } catch(e) {
        console.error('Ошибка проверки уведомлений:', e);
    }
}

// ============================================================
//  КОНКУРС (ГЛОБАЛЬНЫЙ)
// ============================================================

function startContest() {
    if (globalData.contest_active) { showToast('Конкурс уже запущен'); return; }
    
    fetch(SERVER_URL + '/api/set_contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            active: true, 
            end_time: Date.now() + 6 * 60 * 60 * 1000,
            winner: null
        })
    }).then(() => {
        loadGlobalData();
        showToast('Конкурс запущен на 6 часов!');
    });
}

function endContest() {
    if (!globalData.contest_active) return;
    
    let maxStars = -1;
    let winnerUid = null;
    for (const userId in window.users) {
        const user = window.users[userId];
        if (user && user.uid && !user.banned) {
            const total = (user.stars || 0) + (user.bank || 0);
            if (total > maxStars) {
                maxStars = total;
                winnerUid = user.uid;
            }
        }
    }
    
    fetch(SERVER_URL + '/api/set_contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            active: false, 
            end_time: null,
            winner: winnerUid
        })
    }).then(() => {
        if (winnerUid) {
            const winner = getUserByUid(winnerUid);
            if (winner) {
                winner.stars += 500;
                winner.attempts += 3;
                addNotification(winnerUid, 'Вы победили в конкурсе! +500 звезд и +3 попытки!');
                showToast('Победитель: ' + winnerUid + '! +500 звезд и +3 попытки!');
                saveToServer();
            }
        }
        loadGlobalData();
    });
}

function forceEndContest() {
    if (!globalData.contest_active) { showToast('Конкурс не запущен'); return; }
    endContest();
}

// ============================================================
//  УВЕДОМЛЕНИЯ
// ============================================================

function addNotification(uid, message) {
    fetch(SERVER_URL + '/api/send_notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            uid: uid, 
            message: message,
            time: new Date().toLocaleString()
        })
    });
    showToast(message, 4000);
}

// ============================================================
//  ПОДДЕРЖКА (ГЛОБАЛЬНАЯ)
// ============================================================

function handleSupport() {
    const user = getCurrentUser();
    const userId = user.uid;

    if (globalData.active_chats && globalData.active_chats[userId]) {
        showChatWindow(userId);
        return;
    }

    openModal('Поддержка', `
        <p>Опишите вашу проблему:</p>
        <input type="text" id="supportInput" placeholder="Ваше сообщение..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="sendSupport()">Отправить</button>
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
                '<button class="btn danger full" onclick="closeChat(\'' + userId + '\')">Завершить чат</button>' :
                '<p style="font-size:12px;color:#888;">Ожидайте ответа администратора</p>';

            const user = getUserByUid(userId);
            const name = user ? user.name || userId : userId;

            openModal('Чат с поддержкой (' + name + ')', `
                <div class="chat-container" id="chatContainer">${messagesHtml || '<p style="color:#888;text-align:center;">Нет сообщений</p>'}</div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="chatInput" placeholder="Введите сообщение..." style="flex:1;" />
                    <button class="btn primary" onclick="sendChatMessage('${userId}')">Отправить</button>
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
//  АДМИН-ФУНКЦИИ (ОБНОВЛЕННЫЕ)
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
    }).then(() => {
        showToast('Сообщение отправлено игроку');
        closeModal();
        loadGlobalData();
        showAdminChat(uid);
    });
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

            openModal('Чат с игроком (' + name + ' | ID: ' + uid + ')', `
                <div class="chat-container" id="adminChatContainer">${messagesHtml || '<p style="color:#888;text-align:center;">Нет сообщений</p>'}</div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="adminChatInput" placeholder="Введите сообщение..." style="flex:1;" />
                    <button class="btn primary" onclick="adminSendMessage('${uid}')">Отправить</button>
                </div>
                <button class="btn danger full" onclick="closeChat('${uid}')">Завершить чат</button>
                <button class="btn full small" onclick="closeModal();">В меню</button>
            `);

            setTimeout(() => {
                const container = document.getElementById('adminChatContainer');
                if (container) container.scrollTop = container.scrollHeight;
            }, 100);
        });
}

// ============================================================
//  КОДЫ (ГЛОБАЛЬНЫЕ)
// ============================================================

window.adminCodeSingle = function() {
    const code = generateCode(10);
    window.oneTimeCodes.add(code);
    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: 'Одноразовый', target: null })
    });
    showToast('Код: ' + code);
    loadGlobalData();
};

window.adminCodeMulti = function() {
    const code = generateCode(10);
    window.multiUseCodes[code] = { remaining: 5, usedUsers: new Set() };
    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: 'На 5', target: null })
    });
    showToast('Код на 5: ' + code);
    loadGlobalData();
};

window.adminBoostSingle = function() {
    const code = generateCode(16);
    window.boosterCodes.add(code);
    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: 'Бустер', target: null })
    });
    showToast('Бустер: ' + code);
    loadGlobalData();
};

window.adminBoostMulti = function() {
    const code = generateCode(16);
    window.boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() };
    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: 'Бустер x5', target: null })
    });
    showToast('Бустер на 5: ' + code);
    loadGlobalData();
};

window.adminSendCodeToPlayer = function() {
    openModal('Отправить код игроку', `
        <p>Введите UID игрока:</p>
        <input type="text" id="sendCodeUid" placeholder="UID игрока" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;text-transform:uppercase;" />
        <p>Выберите тип кода:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn small" onclick="sendCodeToPlayerWithType('single')">Одноразовый</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('multi')">На 5</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('boost')">Бустер</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('boostmulti')">Бустер x5</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.sendCodeToPlayerWithType = function(type) {
    const uidInput = document.getElementById('sendCodeUid');
    if (!uidInput) return;
    const uid = uidInput.value.trim().toUpperCase();
    if (!uid) { showToast('Введите UID'); return; }
    
    const user = getUserByUid(uid);
    if (!user) { 
        showToast('Игрок с таким UID не найден!');
        return;
    }

    let code, typeLabel;
    switch(type) {
        case 'single': code = generateCode(10); window.oneTimeCodes.add(code); typeLabel = 'Одноразовый'; break;
        case 'multi': code = generateCode(10); window.multiUseCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = 'На 5'; break;
        case 'boost': code = generateCode(16); window.boosterCodes.add(code); typeLabel = 'Бустер'; break;
        case 'boostmulti': code = generateCode(16); window.boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = 'Бустер x5'; break;
    }

    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: typeLabel + ' -> ' + uid, target: uid })
    });

    addNotification(uid, 'Вам отправлен код: ' + code + ' (' + typeLabel + ')');
    showToast('Код отправлен игроку ' + uid);
    closeModal();
    loadGlobalData();
    showAdminPanel();
};

window.adminSendCodeToAll = function() {
    openModal('Отправить код всем игрокам', `
        <p>Выберите тип кода:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn small" onclick="sendCodeToAllWithType('single')">Одноразовый</button>
            <button class="btn small" onclick="sendCodeToAllWithType('multi')">На 5</button>
            <button class="btn small" onclick="sendCodeToAllWithType('boost')">Бустер</button>
            <button class="btn small" onclick="sendCodeToAllWithType('boostmulti')">Бустер x5</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.sendCodeToAllWithType = function(type) {
    let code, typeLabel;
    switch(type) {
        case 'single': code = generateCode(10); window.oneTimeCodes.add(code); typeLabel = 'Одноразовый'; break;
        case 'multi': code = generateCode(10); window.multiUseCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = 'На 5'; break;
        case 'boost': code = generateCode(16); window.boosterCodes.add(code); typeLabel = 'Бустер'; break;
        case 'boostmulti': code = generateCode(16); window.boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = 'Бустер x5'; break;
    }

    fetch(SERVER_URL + '/api/add_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, type: typeLabel + ' (всем)', target: 'всем' })
    });

    for (const userId in window.users) {
        const user = window.users[userId];
        if (user && user.uid && !user.banned) {
            addNotification(user.uid, 'Всем игрокам: ' + code + ' (' + typeLabel + ')');
        }
    }

    showToast('Код отправлен всем игрокам');
    closeModal();
    loadGlobalData();
    showAdminPanel();
};

// ============================================================
//  АДМИН-ПАНЕЛЬ
// ============================================================

function handleAdmin() {
    openModal('Админ-панель', `
        <p>Введите пароль:</p>
        <input type="password" id="adminPassword" placeholder="Пароль" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="adminLogin()">Войти</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.adminLogin = function() {
    const input = document.getElementById('adminPassword');
    if (!input) return;
    const pass = input.value.trim();
    if (pass !== 'Qw12') { showToast('Неверный пароль'); return; }
    showAdminPanel();
};

function showAdminPanel() {
    let chatList = '';
    if (globalData.active_chats) {
        const chatKeys = Object.keys(globalData.active_chats);
        if (chatKeys.length > 0) {
            chatList = '<p><strong>Активные чаты:</strong></p><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">';
            chatKeys.forEach(uid => {
                const user = getUserByUid(uid);
                const name = user ? user.name || uid : uid;
                chatList += '<button class="btn small" onclick="adminOpenChat(\'' + uid + '\')" style="margin:2px;">Чат ' + name + '</button>';
            });
            chatList += '</div>';
        }
    }

    const contestStatus = globalData.contest_active ? 
        '<span style="color:#ffd700;">Активен (' + Math.floor((globalData.contest_end_time - Date.now()) / 60000) + ' мин)</span>' : 
        '<span style="color:#888;">Не активен</span>';

    openModal('Панель управления', `
        <div class="admin-panel">
            <p><strong>Конкурс:</strong> ${contestStatus}</p>
            <div style="display:flex;gap:8px;">
                <button class="btn primary small" onclick="startContest()">Запустить</button>
                <button class="btn danger small" onclick="forceEndContest()">Завершить</button>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;" />
            ${chatList}
            <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn small" onclick="adminCodeSingle()">Код 1</button>
                <button class="btn small" onclick="adminCodeMulti()">Код 5</button>
                <button class="btn small" onclick="adminBoostSingle()">Бустер</button>
                <button class="btn small" onclick="adminBoostMulti()">Бустер x5</button>
                <button class="btn small" onclick="adminSendCodeToPlayer()">Отправить код игроку</button>
                <button class="btn small" onclick="adminSendCodeToAll()">Отправить код всем</button>
                <button class="btn small" onclick="adminMassGive()">Попытки всем</button>
                <button class="btn small" onclick="adminGiveSelfStars()">Звёзды себе</button>
                <button class="btn small" onclick="adminPlayerMenu()">Игроки</button>
                <button class="btn small danger" onclick="adminReports()">Жалобы</button>
                <button class="btn small" onclick="adminTop()">Топ-30</button>
            </div>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        </div>
    `);
}

// ============================================================
//  АДМИН-ОСТАЛЬНОЕ (ОБНОВЛЕННОЕ)
// ============================================================

window.adminReports = function() {
    if (!globalData.reports || globalData.reports.length === 0) {
        showToast('Жалоб пока нет');
        return;
    }

    let text = 'Жалобы:\n\n';
    const last = globalData.reports.slice(-10);
    for (const r of last) {
        text += 'От ' + r.username + ' (ID: ' + r.uid + ') [' + r.time + ']:\n' + r.text + '\n\n';
    }

    let chatButtons = '';
    if (globalData.active_chats) {
        const chatKeys = Object.keys(globalData.active_chats);
        if (chatKeys.length > 0) {
            chatButtons = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;">';
            chatKeys.forEach(uid => {
                const user = getUserByUid(uid);
                const name = user ? user.name || uid : uid;
                chatButtons += '<button class="btn small" onclick="adminOpenChat(\'' + uid + '\')">Чат ' + name + '</button>';
            });
            chatButtons += '</div>';
        }
    }

    openModal('Жалобы и чаты', `
        <div class="scrollable"><pre style="color:#c0c0e0;font-family:inherit;white-space:pre-wrap;font-size:14px;">${text}</pre></div>
        ${chatButtons}
        <button class="btn danger full" onclick="fetch('${SERVER_URL}/api/clear_reports', {method:'POST'}); globalData.reports=[]; closeModal(); showToast('Жалобы очищены'); showAdminPanel();">Очистить жалобы</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.adminPlayerMenu = function() {
    openModal('Управление игроком', `
        <p>Введите UID игрока:</p>
        <input type="text" id="playerUidInput" placeholder="UID игрока" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;text-transform:uppercase;" />
        <button class="btn primary full" onclick="showPlayerInfo()">Найти</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

// ===== ОБНОВЛЕННАЯ ФУНКЦИЯ ПОКАЗА ИГРОКА =====
window.showPlayerInfo = function() {
    const input = document.getElementById('playerUidInput');
    if (!input) return;
    const uid = input.value.trim().toUpperCase();
    if (!uid) { showToast('Введите UID'); return; }
    
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

    openModal('Игрок: ' + name + ' (' + uid + ')', `
        <p><strong>Статистика:</strong></p>
        <p>Имя: ${name}</p>
        <p>Пол: ${gender}</p>
        <p>Возраст: ${age}</p>
        <p>Звёзды: <strong style="color:#ffd700;">${stars}</strong></p>
        <p>Банк: <strong style="color:#00d4ff;">${bank}</strong></p>
        <p>Попытки: ${attempts}</p>
        <p>Коэффициент: +${coeff}</p>
        <p>Кликер: ${clickerProgress}/400</p>
        <p>Статус: ${isBanned ? 'ЗАБЛОКИРОВАН' : 'Активен'}</p>
        ${isBanned ? '<p style="color:#ff4757;">Причина: ' + banReason + '</p>' : ''}
        <hr />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn small" onclick="adminAddStars('${uid}')">+ Звёзды</button>
            <button class="btn small danger" onclick="adminRemoveStars('${uid}')">- Звёзды</button>
            ${isBanned ? 
                '<button class="btn small" onclick="adminUnbanUserByUid(\'' + uid + '\')">Разбан</button>' :
                '<button class="btn small danger" onclick="adminBanUserByUid(\'' + uid + '\')">Бан</button>'
            }
            <button class="btn small" onclick="adminOpenChat(' + "'" + uid + "'" + ')">Чат</button>
            <button class="btn small danger" onclick="adminResetPlayer(' + "'" + uid + "'" + ')">Сброс</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

// ===== ОБНОВЛЕННАЯ ВЫДАЧА ЗВЕЗД =====
window.adminAddStars = function(uid) {
    openModal('Добавить звёзды игроку ' + uid, `
        <input type="number" id="addStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="doAddStars('${uid}')">Добавить</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doAddStars = function(uid) {
    const input = document.getElementById('addStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    
    fetch(SERVER_URL + '/api/admin_add_stars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid, amount: amount })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message);
            closeModal();
            loadFromServer();
            render();
            setTimeout(function() { showPlayerInfo(); }, 500);
        } else {
            showToast('Ошибка: ' + data.message);
        }
    })
    .catch(function(e) {
        console.error('Ошибка выдачи звёзд:', e);
        showToast('Ошибка сервера');
    });
};

// ===== ОБНОВЛЕННАЯ КОНФИСКАЦИЯ ЗВЕЗД =====
window.adminRemoveStars = function(uid) {
    openModal('Забрать звёзды у игрока ' + uid, `
        <input type="number" id="removeStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn danger full" onclick="doRemoveStars('${uid}')">Забрать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doRemoveStars = function(uid) {
    const input = document.getElementById('removeStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    
    fetch(SERVER_URL + '/api/admin_remove_stars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid, amount: amount })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message);
            closeModal();
            loadFromServer();
            render();
            setTimeout(function() { showPlayerInfo(); }, 500);
        } else {
            showToast('Ошибка: ' + data.message);
        }
    })
    .catch(function(e) {
        console.error('Ошибка конфискации звёзд:', e);
        showToast('Ошибка сервера');
    });
};

// ===== ОБНОВЛЕННЫЙ СБРОС АККАУНТА =====
window.adminResetPlayer = function(uid) {
    if (!confirm('Вы уверены, что хотите сбросить игрока ' + uid + '?')) return;
    
    fetch(SERVER_URL + '/api/admin_reset_player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message);
            closeModal();
            loadFromServer();
            render();
            setTimeout(function() { showPlayerInfo(); }, 500);
        } else {
            showToast('Ошибка: ' + data.message);
        }
    })
    .catch(function(e) {
        console.error('Ошибка сброса аккаунта:', e);
        showToast('Ошибка сервера');
    });
};

// ===== ВЫДАЧА ЗВЕЗД СЕБЕ =====
window.adminGiveSelfStars = function() {
    openModal('Начислить звёзды себе', `
        <input type="number" id="selfStarsInput" placeholder="Сумма" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="doGiveSelfStars()">Начислить</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>
    `);
};

window.doGiveSelfStars = function() {
    const input = document.getElementById('selfStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
    
    fetch(SERVER_URL + '/api/admin_give_self_stars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: getUserId(), amount: amount })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message);
            closeModal();
            loadFromServer();
            render();
            setTimeout(function() { showAdminPanel(); }, 500);
        } else {
            showToast('Ошибка: ' + data.message);
        }
    })
    .catch(function(e) {
        console.error('Ошибка выдачи звёзд себе:', e);
        showToast('Ошибка сервера');
    });
};

// ===== БАН И РАЗБАН =====
window.adminBanUserByUid = function(uid) {
    openModal('Блокировка игрока ' + uid, `
        <p>Введите причину блокировки:</p>
        <input type="text" id="banReasonInput" placeholder="Причина блокировки..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn danger full" onclick="doBanUser('${uid}')">Заблокировать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">Назад</button>
    `);
};

window.doBanUser = function(uid) {
    const input = document.getElementById('banReasonInput');
    if (!input) return;
    const reason = input.value.trim() || 'Нарушение правил';
    
    window.bannedUsers[uid] = reason;
    const user = getUserByUid(uid);
    if (user) {
        user.banned = true;
        user.banned_reason = reason;
    }
    saveAllData();
    syncGlobalData();
    addNotification(uid, 'Вас заблокировали. Причина: ' + reason);
    showToast(uid + ' заблокирован. Причина: ' + reason);
    closeModal();
    render();
    saveAllData();
    setTimeout(function() { showPlayerInfo(); }, 500);
};

window.adminUnbanUserByUid = function(uid) {
    if (window.bannedUsers[uid]) {
        delete window.bannedUsers[uid];
        const user = getUserByUid(uid);
        if (user) {
            user.banned = false;
            user.banned_reason = '';
        }
        saveAllData();
        syncGlobalData();
        addNotification(uid, 'Вас разблокировали!');
        showToast(uid + ' разблокирован');
        closeModal();
        render();
        saveAllData();
        setTimeout(function() { showPlayerInfo(); }, 500);
    }
};

window.adminMassGive = function() {
    let count = 0;
    for (const userId in window.users) {
        const user = window.users[userId];
        if (user && !user.banned) {
            user.attempts += 1;
            count++;
        }
    }
    showToast('+1 попытка выдана ' + count + ' игрокам');
    saveAllData();
    saveToServer();
};

window.adminTop = function() {
    const usersList = getAllUsersList();
    let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>ID</th><th>Имя</th><th>Звёзды</th></tr></thead><tbody>';
    const sorted = usersList
        .filter(u => !u.banned)
        .sort((a, b) => (b.stars || 0) - (a.stars || 0))
        .slice(0, 30);
    if (sorted.length === 0) {
        html += '<tr><td colspan="4" style="text-align:center;color:#888;">Нет игроков</td></tr>';
    }
    sorted.forEach((item, i) => {
        html += '<tr><td>' + (i+1) + '</td><td>' + item.uid + '</td><td>' + item.name + '</td><td>' + item.stars + '</td></tr>';
    });
    html += '</tbody></table><button class="btn full small" onclick="closeModal(); showAdminPanel();">Назад</button>';
    openModal('Топ-30', html);
};

// ============================================================
//  КОЛЕСО УДАЧИ И ОСТАЛЬНЫЕ ИГРОВЫЕ ФУНКЦИИ
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

let wheelCanvas, ctx;
let wheelSegments = [];
let currentAngle = 0;
let isSpinning = false;
let winIndex = 0;

function initWheel() {
    wheelCanvas = document.getElementById('wheelCanvas');
    if (!wheelCanvas) return;
    ctx = wheelCanvas.getContext('2d');
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    drawWheel();
}

function drawWheel(highlightIndex = -1) {
    if (!ctx || !wheelCanvas) return;
    const w = wheelCanvas.width;
    const h = wheelCanvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2 - 10;
    const segCount = wheelSegments.length;
    const angleStep = (2 * Math.PI) / segCount;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < segCount; i++) {
        const startAngle = currentAngle + i * angleStep;
        const endAngle = startAngle + angleStep;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        const isHighlight = (i === highlightIndex);
        if (isHighlight) {
            ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
            ctx.shadowBlur = 30;
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            ctx.fillStyle = '#3d3d5c';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const midAngle = startAngle + angleStep / 2;
        const textRadius = radius * 0.65;
        const x = centerX + Math.cos(midAngle) * textRadius;
        const y = centerY + Math.sin(midAngle) * textRadius;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(midAngle + (midAngle > Math.PI/2 ? Math.PI : 0));

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isHighlight) {
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            ctx.shadowBlur = 15;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.font = '20px Segoe UI, sans-serif';
        ctx.fillStyle = isHighlight ? '#1a1a2e' : '#8888aa';
        ctx.fillText(wheelSegments[i].icon, 0, -10);

        ctx.font = '9px Segoe UI, sans-serif';
        if (wheelSegments[i].value > 0) {
            ctx.fillStyle = isHighlight ? '#1a1a2e' : '#666688';
            ctx.fillText(wheelSegments[i].value + '⭐', 0, 16);
        } else {
            ctx.fillStyle = isHighlight ? '#1a1a2e' : '#444466';
            ctx.fillText('—', 0, 16);
        }

        ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    grad.addColorStop(0, 'rgba(255,215,0,0.02)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
}

function spinWheel() {
    if (isSpinning) return;
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
        showToast('Попыток нет! Купите в меню.');
        return;
    }

    isSpinning = true;
    document.getElementById('wheelSpinBtn').disabled = true;
    document.getElementById('wheelResult').textContent = 'Крутим...';

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
        resultDiv.innerHTML = 'Ничего не выиграно!';
        showToast('Ничего не выиграно');
        return;
    }

    let finalValue = result.value;
    if (coeff > 0) finalValue = Math.round(result.value + coeff);

    user.stars += finalValue;
    resultDiv.innerHTML = '+' + finalValue + ' ⭐ (' + result.label + ')';
    showToast('+' + finalValue + ' ⭐');
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
//  РЕГИСТРАЦИЯ
// ============================================================

function showRegistration() {
    const uids = generateThreeUids();
    
    openModal('Регистрация', `
        <p>Добро пожаловать! Давайте зарегистрируемся.</p>
        <p>Введите ваше имя:</p>
        <input type="text" id="regName" placeholder="Имя" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <p>Выберите пол:</p>
        <div style="display:flex;gap:8px;margin:5px 0;">
            <button class="btn" onclick="selectGender('Мужской')" style="flex:1;">Мужской</button>
            <button class="btn" onclick="selectGender('Женский')" style="flex:1;">Женский</button>
        </div>
        <p>Введите возраст:</p>
        <input type="number" id="regAge" placeholder="Возраст" min="1" max="120" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <p style="color:#ffd700;font-weight:bold;">Выберите ваш уникальный ID (навсегда):</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:5px 0;">
            <button class="btn primary" onclick="selectUid('${uids[0]}')" id="uidBtn0" style="flex:1;font-weight:bold;font-size:18px;">${uids[0]}</button>
            <button class="btn primary" onclick="selectUid('${uids[1]}')" id="uidBtn1" style="flex:1;font-weight:bold;font-size:18px;">${uids[1]}</button>
            <button class="btn primary" onclick="selectUid('${uids[2]}')" id="uidBtn2" style="flex:1;font-weight:bold;font-size:18px;">${uids[2]}</button>
        </div>
        <div id="selectedUidDisplay" style="text-align:center;margin:8px 0;font-size:16px;color:#6bcbff;"></div>
        <button class="btn primary full" id="regCompleteBtn" onclick="completeRegistration()" disabled>Завершить</button>
    `);
}

let regData = { name: '', gender: '', age: '', uid: '' };
let genderSelected = false;

window.selectGender = function(g) {
    genderSelected = true;
    regData.gender = g;
    showToast('Пол: ' + g);
    checkRegistrationReady();
};

window.selectUid = function(uid) {
    regData.uid = uid;
    document.getElementById('selectedUidDisplay').textContent = 'Выбран ID: ' + uid;
    document.getElementById('selectedUidDisplay').style.color = '#ffd700';
    document.querySelectorAll('#modalBody .btn.primary').forEach(btn => {
        btn.style.border = '2px solid transparent';
        if (btn.textContent.trim() === uid) {
            btn.style.border = '2px solid #ffd700';
            btn.style.background = 'linear-gradient(145deg, #ffd700, #f5a623)';
        }
    });
    checkRegistrationReady();
};

function checkRegistrationReady() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
    const btn = document.getElementById('regCompleteBtn');
    if (nameInput && ageInput && btn) {
        const name = nameInput.value.trim();
        const age = parseInt(ageInput.value);
        if (name.length > 0 && age > 0 && age <= 120 && genderSelected && regData.uid) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    }
}

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
    if (!regData.uid) {
        showToast('Выберите ID');
        return;
    }

    const user = getCurrentUser();
    user.name = regData.name;
    user.gender = regData.gender;
    user.age = regData.age;
    user.uid = regData.uid;
    user.registered = true;
    
    window.uidMap[regData.uid] = getUserId();
    
    closeModal();
    showToast('Регистрация завершена! Ваш ID: ' + regData.uid);
    render();
    saveAllData();
    saveToServer();
};

function checkRegistration() {
    const user = getCurrentUser();
    if (!user.registered) {
        showRegistration();
    }
}

// ============================================================
//  ОСТАЛЬНЫЕ ИГРОВЫЕ ФУНКЦИИ
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
    
    document.getElementById('userName').textContent = user.name || '—';
    document.getElementById('userGender').textContent = user.gender || '—';
    document.getElementById('userAge').textContent = user.age || '—';
    document.getElementById('userUid').textContent = user.uid || '—';
    document.getElementById('userAttempts').textContent = user.attempts || 0;
    document.getElementById('starsBalance').textContent = user.stars || 0;
    document.getElementById('bankBalance').textContent = user.bank || 0;
    
    const statusEl = document.getElementById('userRegStatus');
    if (user.banned) {
        statusEl.textContent = 'ЗАБЛОКИРОВАН: ' + (user.banned_reason || 'Нарушение правил');
        statusEl.style.color = '#ff4757';
    } else if (user.registered) {
        statusEl.textContent = 'Зарегистрирован (ID: ' + (user.uid || '—') + ')';
        statusEl.style.color = '#4caf50';
    } else {
        statusEl.textContent = 'Не зарегистрирован';
        statusEl.style.color = '#ff4757';
    }
    
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = stage === 1 ? 100 : stage === 2 ? 500 : stage === 3 ? 1500 : 0;
    const stageText = stage === 1 ? 'Малыш' : stage === 2 ? 'Подросток' : stage === 3 ? 'Взрослый' : 'Гигант';
    document.getElementById('petStage').textContent = stageText;
    document.getElementById('petProgress').textContent = progress + ' / ' + threshold + ' ⭐';
    
    renderAdminCodes();
    renderContest();
    
    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;
}

function renderAdminCodes() {
    const panel = document.getElementById('codesPanel');
    const list = document.getElementById('codesList');
    if (!panel || !list) return;
    
    const codes = globalData.admin_codes || [];
    if (codes.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    list.innerHTML = codes.map((item, index) => `
        <div class="code-item">
            <span class="code-text" onclick="copyCode('${item.code}')">${item.code}</span>
            <span class="code-type">${item.type} ${item.target ? '-> ' + item.target : ''}</span>
            <span class="code-delete" onclick="deleteCodeGlobal('${item.code}')">✕</span>
        </div>
    `).join('');
}

window.deleteCodeGlobal = function(code) {
    fetch(SERVER_URL + '/api/delete_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
    }).then(() => {
        loadGlobalData();
        showToast('Код удалён');
    });
};

window.copyCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Код скопирован!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Код скопирован!');
    });
};

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
    let winnerText = '';
    if (globalData.contest_winner) {
        winnerText = '<div class="winner">Победитель: <strong>' + globalData.contest_winner + '</strong></div>';
    }
    banner.innerHTML = `
        <div class="title">КОНКУРС</div>
        <div class="timer">${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</div>
        <div style="font-size:12px;color:#aaa;">Победит тот, у кого больше звёзд (баланс + банк)</div>
        ${winnerText}
    `;
}

// ============================================================
//  ОБРАБОТЧИКИ
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
        showToast('Попыток нет! Купите в меню.');
        return;
    }
    openWheel();
}

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
    const bank = user.bank || 0;
    const deposit = user.bankDeposit || 0;
    if (bank > 0) {
        openModal('Банк (20% в час)', `
            <p>В банке: <strong>${bank}</strong> ⭐</p>
            <p>Первоначальный вклад: <strong>${deposit}</strong> ⭐</p>
            <p>Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
            <button class="btn primary full" onclick="withdrawBank()">Забрать все ⭐</button>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        `);
    } else {
        openModal('Банк (20% в час)', `
            <p>Банк пуст.</p>
            <p>Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
            <input type="number" id="bankDepositInput" placeholder="Сумма для вклада" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
            <button class="btn primary full" onclick="depositBank()">Положить в банк</button>
            <button class="btn full small" onclick="closeModal();">В меню</button>
        `);
    }
}

window.withdrawBank = function() {
    const user = getCurrentUser();
    const amount = user.bank || 0;
    if (amount <= 0) { showToast('Банк пуст'); return; }
    user.stars += amount;
    user.bank = 0;
    user.bankDeposit = 0;
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
    closeModal();
    showToast(amount + ' ⭐ положены в банк под 20% в час');
    render();
    saveAllData();
    saveToServer();
};

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

    openModal('Кликер звёзд', `
        <div style="text-align:center;">
            <div class="clicker-star" id="clickerStar" onclick="clickStar()">⭐</div>
            <div class="clicker-stats">
                <span>Прогресс: <strong id="clickerProgress">${progress}</strong> / 400</span>
                <span>Награда: <strong id="clickerReward">${reward}</strong> ⭐</span>
            </div>
            <div class="clicker-progress">
                <div class="fill" id="clickerFill" style="width: ${(progress/400)*100}%;"></div>
            </div>
            <p style="font-size:13px;color:#888;margin-top:8px;">
                ${remaining > 0 ? 'Осталось кликов: ' + remaining : 'Готово! Заберите награду!'}
            </p>
            ${progress >= 400 ? '<button class="btn primary full" onclick="claimClickerReward()">Забрать ' + reward + ' ⭐</button>' : ''}
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
        infoP.textContent = remaining > 0 ? 'Осталось кликов: ' + remaining : 'Готово! Заберите награду!';
    }
    if (progress >= 400) {
        const btn = document.querySelector('button[onclick="claimClickerReward()"]');
        if (!btn) {
            const container = document.querySelector('.clicker-stats + p');
            if (container) {
                container.innerHTML = '<button class="btn primary full" onclick="claimClickerReward()">Забрать 20 ⭐</button>';
            }
        }
        showToast('400 кликов! Заберите награду!');
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

function handleCoeff() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    openModal('Коэффициент', `
        <p>Введите сумму (10% станут коэффициентом):</p>
        <input type="number" id="coeffInput" placeholder="Сумма" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="setCoeff()">Применить</button>
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
    user.coefficientRate = Math.round(amount * 0.1 * 10) / 10;
    closeModal();
    showToast('Коэффициент: +' + user.coefficientRate + ' ⭐');
    render();
    saveAllData();
    saveToServer();
};

function handlePet() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = stage === 1 ? 100 : stage === 2 ? 500 : stage === 3 ? 1500 : 0;
    const stageText = stage === 1 ? 'Малыш' : stage === 2 ? 'Подросток' : stage === 3 ? 'Взрослый' : 'Гигант';
    const passive = { 1: 0, 2: 20, 3: 50, giant: 300 }[stage] || 0;

    openModal('Питомец', `
        <p><strong>${stageText}</strong></p>
        <p>Прогресс: ${progress} / ${threshold} ⭐</p>
        ${passive > 0 ? '<p>Пассивный доход: ' + passive + ' ⭐/час</p>' : ''}
        <input type="number" id="petFeedInput" placeholder="Сколько звёзд скормить?" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="feedPet()">Покормить</button>
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
    const threshold = stage === 1 ? 100 : stage === 2 ? 500 : stage === 3 ? 1500 : 0;
    const maxFeed = threshold - user.petProgress;
    if (amount > maxFeed && threshold > 0) {
        showToast('Максимум ' + maxFeed + ' ⭐');
        return;
    }
    user.stars -= amount;
    user.petProgress += amount;

    if (threshold > 0 && user.petProgress >= threshold) {
        user.petProgress -= threshold;
        if (stage === 1) {
            user.stars += 200;
            user.petStage = 2;
            showToast('Стадия 2! +200 ⭐');
        } else if (stage === 2) {
            user.stars += 800;
            user.petStage = 3;
            showToast('Стадия 3! +800 ⭐');
        } else if (stage === 3) {
            user.stars += 1000;
            user.petStage = 'giant';
            showToast('Гигант! +1000 ⭐');
        }
    } else {
        showToast('Прогресс: ' + user.petProgress + '/' + threshold + ' ⭐');
    }
    closeModal();
    render();
    saveAllData();
    saveToServer();
};

function handleBuy() {
    const user = getCurrentUser();
    if (!user.registered || user.banned) { showToast('Сначала зарегистрируйтесь!'); return; }
    openModal('Покупка попыток', `
        <p>Ваш баланс: <strong>${user.stars}</strong> ⭐</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn primary" onclick="buyAttempts(1, 100)" style="flex:1;">1 попытка — 100⭐</button>
            <button class="btn primary" onclick="buyAttempts(2, 180)" style="flex:1;">2 — 180⭐</button>
            <button class="btn primary" onclick="buyAttempts(4, 340)" style="flex:1;">4 — 340⭐</button>
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
    openModal('Ввести код', `
        <p>Введите код для активации бонуса:</p>
        <input type="text" id="codeInput" placeholder="Код" style="text-transform:uppercase;width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="applyCode()">Активировать</button>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
}

window.applyCode = function() {
    const user = getCurrentUser();
    const input = document.getElementById('codeInput');
    if (!input) return;
    const text = input.value.trim().toUpperCase();
    if (!text) { showToast('Введите код'); return; }

    let found = false;
    for (const code of window.boosterCodes) {
        if (code === text) {
            window.boosterCodes.delete(code);
            user.attempts += 1;
            user.boosted = true;
            found = true;
            closeModal();
            showToast('Бустер активирован!');
            render();
            saveAllData();
            return;
        }
    }
    for (const code in window.boosterMultiCodes) {
        if (code === text) {
            if (window.boosterMultiCodes[code].usedUsers.has(user.uid)) {
                showToast('Уже использован');
                return;
            }
            user.attempts += 1;
            user.boosted = true;
            window.boosterMultiCodes[code].usedUsers.add(user.uid);
            window.boosterMultiCodes[code].remaining--;
            if (window.boosterMultiCodes[code].remaining <= 0) {
                delete window.boosterMultiCodes[code];
            }
            found = true;
            closeModal();
            showToast('Бустер активирован!');
            render();
            saveAllData();
            return;
        }
    }
    for (const code of window.oneTimeCodes) {
        if (code === text) {
            window.oneTimeCodes.delete(code);
            user.attempts += 1;
            found = true;
            closeModal();
            showToast('Код принят!');
            render();
            saveAllData();
            return;
        }
    }
    for (const code in window.multiUseCodes) {
        if (code === text) {
            if (window.multiUseCodes[code].usedUsers.has(user.uid)) {
                showToast('Уже использован');
                return;
            }
            user.attempts += 1;
            window.multiUseCodes[code].usedUsers.add(user.uid);
            window.multiUseCodes[code].remaining--;
            if (window.multiUseCodes[code].remaining <= 0) {
                delete window.multiUseCodes[code];
            }
            found = true;
            closeModal();
            showToast('Код принят!');
            render();
            saveAllData();
            return;
        }
    }
    if (!found) showToast('Неверный код');
};

function handleLeaderboard() {
    loadAllUsersFromServer().then(() => {
        const usersList = getAllUsersList();
        let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>ID</th><th>Имя</th><th>⭐</th></tr></thead><tbody>';
        const sorted = usersList
            .filter(u => !u.banned)
            .sort((a, b) => (b.stars || 0) - (a.stars || 0))
            .slice(0, 30);
        if (sorted.length === 0) {
            html += '<tr><td colspan="4" style="text-align:center;color:#888;">Нет игроков</td></tr>';
        }
        sorted.forEach((item, i) => {
            html += '<tr><td>' + (i+1) + '</td><td>' + item.uid + '</td><td>' + item.name + '</td><td>' + item.stars + '</td></tr>';
        });
        html += '</tbody></table><button class="btn full small" onclick="closeModal();">В меню</button>';
        openModal('Таблица лидеров', html);
    });
}

function handleRules() {
    openModal('Правила', `
        <div class="scrollable">
            <p><strong>Колесо удачи</strong></p>
            <p>• 1 сектор "Ничего" (60% шанс)</p>
            <p>• 9 призовых секторов (40% шанс)</p>
            <p>• Призы: 10⭐, 25⭐, 50⭐, 100⭐, 150⭐, 200⭐, 300⭐, 500⭐, 1000⭐</p>
            <br>
            <p><strong>Банк</strong></p>
            <p>• 20% в час от первоначальной суммы</p>
            <br>
            <p><strong>Кликер</strong></p>
            <p>• 400 кликов → +20 ⭐</p>
            <br>
            <p><strong>Питомец</strong></p>
            <p>• Растёт от кормления звёздами</p>
            <p>• Приносит пассивный доход</p>
            <br>
            <p><strong>Коды</strong></p>
            <p>• Вводите коды для бонусов</p>
            <br>
            <p><strong>Администратор всегда прав!</strong></p>
        </div>
        <button class="btn full small" onclick="closeModal();">В меню</button>
    `);
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
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен!');
    
    document.getElementById('btnPlay').addEventListener('click', function() {
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
            showToast('Попыток нет! Купите в меню.');
            return;
        }
        openWheel();
    });
    
    document.getElementById('btnBank').addEventListener('click', handleBank);
    document.getElementById('btnClicker').addEventListener('click', handleClicker);
    document.getElementById('btnCoeff').addEventListener('click', handleCoeff);
    document.getElementById('btnPet').addEventListener('click', handlePet);
    document.getElementById('btnBuy').addEventListener('click', handleBuy);
    document.getElementById('btnCode').addEventListener('click', handleCode);
    document.getElementById('btnLeaderboard').addEventListener('click', handleLeaderboard);
    document.getElementById('btnRules').addEventListener('click', handleRules);
    document.getElementById('btnSupport').addEventListener('click', handleSupport);
    document.getElementById('btnAdmin').addEventListener('click', handleAdmin);
    
    document.getElementById('wheelSpinBtn').addEventListener('click', spinWheel);
    document.getElementById('wheelCloseBtn').addEventListener('click', closeWheel);
    document.getElementById('wheelCanvas').addEventListener('click', spinWheel);
    
    render();
    initWheel();
    
    setTimeout(async function() {
        await loadGlobalData();
        await loadFromServer();
        await loadAllUsersFromServer();
        setTimeout(checkRegistration, 500);
        render();
    }, 500);
    
    console.log('Все обработчики назначены!');
});

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

// ===== ЗАПУСК СИНХРОНИЗАЦИИ =====
setInterval(async function() {
    await syncWithServer();
}, 5000);

setTimeout(async function() {
    await syncWithServer();
}, 1000);
