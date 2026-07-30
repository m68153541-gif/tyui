console.log('🚀 Игра загружается...');

// ============================================================
//  ПРИВЯЗКА К TELEGRAM ИЛИ localStorage
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
    } catch(e) {
        console.log('Telegram WebApp не доступен');
    }
    return null;
}

function getUserId() {
    const tgId = getTelegramUserId();
    if (tgId) {
        return 'tg_' + tgId;
    }
    
    let userId = localStorage.getItem('game_user_id');
    if (!userId) {
        userId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('game_user_id', userId);
    }
    return userId;
}

// ============================================================
//  ХРАНИЛИЩЕ
// ============================================================

let users = {};
let uidMap = {};
let bannedUsers = {};
let oneTimeCodes = new Set();
let multiUseCodes = {};
let boosterCodes = new Set();
let boosterMultiCodes = {};
let reports = [];
let activeChats = {};
let adminCodes = [];
let contestActive = false;
let contestEndTime = null;
let contestWinner = null;

const PASSIVE_INCOME = { 1: 0, 2: 20, 3: 50, "giant": 300 };
const SERVER_URL = window.location.origin;

// ============================================================
//  ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function thresholdForStage(stage) {
    if (stage === 1) return 100;
    if (stage === 2) return 500;
    if (stage === 3) return 1500;
    return 0;
}

function generateUid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    while (true) {
        let uid = '';
        for (let i = 0; i < 6; i++) uid += chars[Math.floor(Math.random() * chars.length)];
        if (!uidMap[uid] && uid !== "admin74zyza") return uid;
    }
}

function generateCode(len = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getUser(userId) {
    if (!users[userId]) {
        const uid = generateUid();
        users[userId] = {
            username: null,
            attempts: 1,
            chatId: null,
            wins: [],
            withdrawals: [],
            boosted: false,
            stars: 300,
            petProgress: 0,
            uid: uid,
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
            notifications: []
        };
        uidMap[uid] = userId;
        setTimeout(() => saveToServer(), 500);
    }
    return users[userId];
}

function getCurrentUser() {
    const userId = getUserId();
    return getUser(userId);
}

function getUserByUid(uid) {
    const userId = uidMap[uid];
    if (userId) return getUser(userId);
    return null;
}

// ============================================================
//  СОХРАНЕНИЕ НА СЕРВЕР
// ============================================================

async function saveToServer() {
    try {
        const user = getCurrentUser();
        const userId = getUserId();
        if (!user || !user.uid) return false;
        if (!user.registered) return false;
        
        const response = await fetch(SERVER_URL + '/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: userId,
                user_data: user 
            })
        });
        const result = await response.json();
        console.log('✅ Сохранено на сервер:', result);
        return result.success;
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
        return false;
    }
}

async function loadFromServer() {
    try {
        const userId = getUserId();
        if (!userId) return false;
        
        const response = await fetch(SERVER_URL + `/api/load/${userId}`);
        if (response.ok) {
            const data = await response.json();
            const user = getCurrentUser();
            const oldUid = user.uid;
            const oldRegistered = user.registered;
            
            Object.assign(user, data);
            user.uid = oldUid;
            
            if (oldRegistered && !data.registered) {
                user.registered = true;
            }
            
            console.log('✅ Загружено с сервера:', data);
            render();
            return true;
        } else {
            console.log('ℹ️ Новый пользователь, данных на сервере нет');
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
    }
    return false;
}

// ============================================================
//  ОБНОВЛЕНИЯ
// ============================================================

function updatePassiveIncome(userData) {
    const now = Date.now();
    const lastTime = userData.lastPassiveTime || now;
    if (lastTime >= now) return;
    const delta = (now - lastTime) / 3600000;
    if (delta < 1) return;
    const stage = userData.petStage || 1;
    const income = PASSIVE_INCOME[stage] || 0;
    if (income > 0) {
        const earned = Math.floor(delta * income);
        if (earned > 0) userData.stars = (userData.stars || 0) + earned;
    }
    userData.lastPassiveTime = now;
}

function updateBankInterest(userData) {
    const now = Date.now();
    const lastTime = userData.bankTime || now;
    if (lastTime >= now) return;
    const delta = (now - lastTime) / 3600000;
    if (delta < 1) return;
    const deposit = userData.bankDeposit || 0;
    if (deposit > 0) {
        const earned = Math.floor(deposit * 0.20 * delta);
        if (earned > 0) userData.bank = (userData.bank || 0) + earned;
    }
    userData.bankTime = now;
}

function addNotification(uid, message) {
    const user = getUserByUid(uid);
    if (user) {
        if (!user.notifications) user.notifications = [];
        user.notifications.push({ text: message, time: new Date().toLocaleString(), read: false });
        saveToServer();
    }
}

function getNotifications(uid) {
    const user = getUserByUid(uid);
    if (user && user.notifications) {
        const unread = user.notifications.filter(n => !n.read);
        user.notifications.forEach(n => n.read = true);
        return unread;
    }
    return [];
}

// ============================================================
//  ОТРИСОВКА
// ============================================================

function render() {
    const user = getCurrentUser();
    updatePassiveIncome(user);
    updateBankInterest(user);

    document.getElementById('userName').textContent = user.name || '—';
    document.getElementById('userGender').textContent = user.gender || '—';
    document.getElementById('userAge').textContent = user.age || '—';
    document.getElementById('userUid').textContent = user.uid || '—';
    document.getElementById('userAttempts').textContent = user.attempts || 0;
    document.getElementById('starsBalance').textContent = user.stars || 0;
    document.getElementById('bankBalance').textContent = user.bank || 0;

    const statusEl = document.getElementById('userRegStatus');
    if (bannedUsers[user.uid]) {
        statusEl.textContent = '🚫 ЗАБЛОКИРОВАН: ' + bannedUsers[user.uid];
        statusEl.style.color = '#ff4757';
    } else {
        statusEl.textContent = user.registered ? '✅ Зарегистрирован' : '❌ Не зарегистрирован';
        statusEl.style.color = '#c8c8ff';
    }

    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    let stageText = '';
    if (stage === 1) stageText = 'Малыш';
    else if (stage === 2) stageText = 'Подросток';
    else if (stage === 3) stageText = 'Взрослый';
    else stageText = 'Гигант 👑';
    document.getElementById('petStage').textContent = '🪳 ' + stageText;
    document.getElementById('petProgress').textContent = `${progress} / ${threshold} ⭐`;

    const supportBtn = document.getElementById('btnSupport');
    const userId = getCurrentUser().uid;
    if (supportBtn) {
        if (activeChats[userId]) {
            if (activeChats[userId].hasNew) {
                supportBtn.classList.add('support-active');
                supportBtn.innerHTML = '💬 Новое сообщение! <span class="badge">1</span>';
            } else if (activeChats[userId].admin) {
                supportBtn.classList.add('support-active');
                supportBtn.textContent = '💬 Чат с админом';
            } else {
                supportBtn.classList.remove('support-active');
                supportBtn.textContent = '🆘 Поддержка';
            }
        } else {
            supportBtn.classList.remove('support-active');
            supportBtn.textContent = '🆘 Поддержка';
        }
    }

    renderAdminCodes();
    renderContest();
    renderNotifications();
    
    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;

    if (user.registered && user.uid) {
        saveToServer();
    }
}

function renderNotifications() {
    const user = getCurrentUser();
    const notifs = getNotifications(user.uid);
    if (notifs.length > 0) {
        notifs.forEach(n => {
            showToast('📩 ' + n.text, 4000);
        });
    }
}

function renderAdminCodes() {
    const panel = document.getElementById('codesPanel');
    const list = document.getElementById('codesList');
    if (!panel || !list) return;
    if (adminCodes.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    list.innerHTML = adminCodes.map((item, index) => `
        <div class="code-item">
            <span class="code-text" onclick="copyCode('${item.code}')">${item.code}</span>
            <span class="code-type">${item.type} ${item.target ? '→ ' + item.target : ''}</span>
            <span class="code-delete" onclick="deleteCode(${index})">✕</span>
        </div>
    `).join('');
}

function renderContest() {
    const banner = document.getElementById('contestBanner');
    if (!banner) return;
    if (!contestActive) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';
    const now = Date.now();
    const remaining = contestEndTime - now;
    if (remaining <= 0) { endContest(); return; }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    let winnerText = '';
    if (contestWinner) {
        winnerText = `<div class="winner">🏆 Победитель: <strong>${contestWinner}</strong></div>`;
    }
    banner.innerHTML = `
        <div class="title">🏆 КОНКУРС</div>
        <div class="timer">⏱ ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</div>
        <div style="font-size:12px;color:#aaa;">Победит тот, у кого больше звёзд (баланс + банк)</div>
        ${winnerText}
    `;
}

function startContest() {
    if (contestActive) { showToast('❌ Конкурс уже запущен'); return; }
    contestActive = true;
    contestEndTime = Date.now() + 6 * 60 * 60 * 1000;
    contestWinner = null;
    showToast('🏆 Конкурс запущен на 6 часов!');
    render();
}

function endContest() {
    if (!contestActive) return;
    contestActive = false;
    let maxStars = -1;
    let winnerUid = null;
    for (const uid in uidMap) {
        if (bannedUsers[uid]) continue;
        const user = getUserByUid(uid);
        if (user) {
            const total = (user.stars || 0) + (user.bank || 0);
            if (total > maxStars) {
                maxStars = total;
                winnerUid = uid;
            }
        }
    }
    if (winnerUid) {
        contestWinner = winnerUid;
        const winner = getUserByUid(winnerUid);
        if (winner) {
            winner.stars += 500;
            winner.attempts += 3;
            addNotification(winnerUid, '🏆 Вы победили в конкурсе! +500 ⭐ и +3 попытки!');
            showToast(`🏆 Победитель: ${winnerUid}! +500 ⭐ и +3 попытки!`);
        }
    } else {
        showToast('❌ Нет участников для конкурса');
    }
    render();
}

function forceEndContest() {
    if (!contestActive) { showToast('❌ Конкурс не запущен'); return; }
    endContest();
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
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const overlay = document.getElementById('modalOverlay');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = html;
    if (overlay) overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ============================================================
//  КОПИРОВАНИЕ
// ============================================================

window.copyUid = function() {
    const uid = document.getElementById('userUid');
    if (uid && uid.textContent && uid.textContent !== '—') {
        navigator.clipboard.writeText(uid.textContent).then(() => {
            showToast('✅ ID скопирован!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = uid.textContent;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('✅ ID скопирован!');
        });
    }
};

window.copyCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('✅ Код скопирован!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ Код скопирован!');
    });
};

window.deleteCode = function(index) {
    const item = adminCodes[index];
    if (!item) return;
    const code = item.code;
    if (oneTimeCodes.has(code)) oneTimeCodes.delete(code);
    if (multiUseCodes[code]) delete multiUseCodes[code];
    if (boosterCodes.has(code)) boosterCodes.delete(code);
    if (boosterMultiCodes[code]) delete boosterMultiCodes[code];
    adminCodes.splice(index, 1);
    showToast('🗑️ Код удалён');
    render();
};

window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ ID скопирован!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ ID скопирован!');
    });
};

// ============================================================
//  КОЛЕСО УДАЧИ
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
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.attempts <= 0) {
        showToast('❌ Попыток нет! Купите в меню.');
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
    resultDiv.innerHTML = `🎉 +${finalValue} ⭐ (${result.label})`;
    showToast(`🎉 +${finalValue} ⭐`);
    render();
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
//  КЛИКЕР
// ============================================================

function handleClicker() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
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
            <p style="font-size:13px;color:#888;margin-top:8px;">
                ${remaining > 0 ? `Осталось кликов: ${remaining}` : '🎉 Готово! Заберите награду!'}
            </p>
            ${progress >= 400 ? `<button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать ${reward} ⭐</button>` : ''}
            <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
        </div>
    `);
}

window.clickStar = function() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.clickerProgress >= 400) {
        showToast('🎉 Вы уже накликали 400 раз! Заберите награду!');
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
        infoP.textContent = remaining > 0 ? `Осталось кликов: ${remaining}` : '🎉 Готово! Заберите награду!';
    }

    if (progress >= 400) {
        const btn = document.querySelector('button[onclick="claimClickerReward()"]');
        if (!btn) {
            const container = document.querySelector('.clicker-stats + p');
            if (container) {
                container.innerHTML = `<button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать 20 ⭐</button>`;
            }
        }
        showToast('🎉 400 кликов! Заберите награду!');
    }

    render();
};

window.claimClickerReward = function() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.clickerProgress < 400) {
        showToast('❌ Нужно накликать 400 раз!');
        return;
    }

    user.stars += 20;
    user.clickerProgress = 0;
    closeModal();
    showToast('✅ +20 ⭐ за клики!');
    render();
};

// ============================================================
//  КОЭФФИЦИЕНТ
// ============================================================

function handleCoeff() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    openModal('🔥 Коэффициент', `
        <p>Введите сумму (10% станут коэффициентом):</p>
        <input type="number" id="coeffInput" placeholder="Сумма" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="setCoeff()">💎 Применить</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.setCoeff = function() {
    const user = getCurrentUser();
    const input = document.getElementById('coeffInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    if (user.stars < amount) { showToast('❌ Недостаточно звёзд'); return; }
    user.stars -= amount;
    user.coefficientRate = Math.round(amount * 0.1 * 10) / 10;
    closeModal();
    showToast(`✅ Коэффициент: +${user.coefficientRate} ⭐`);
    render();
};

// ============================================================
//  ПИТОМЕЦ
// ============================================================

function handlePet() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    let stageText = '';
    let emoji = '🪳';
    if (stage === 1) stageText = 'Малыш';
    else if (stage === 2) stageText = 'Подросток';
    else if (stage === 3) stageText = 'Взрослый';
    else stageText = 'Гигант 👑';
    const passive = PASSIVE_INCOME[stage] || 0;

    openModal('🪳 Питомец Забава', `
        <p><strong>${emoji} ${stageText}</strong></p>
        <p>Прогресс: ${progress} / ${threshold} ⭐</p>
        ${passive > 0 ? `<p>Пассивный доход: ${passive} ⭐/час</p>` : ''}
        <input type="number" id="petFeedInput" placeholder="Сколько звёзд скормить?" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="feedPet()">🍖 Покормить</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.feedPet = function() {
    const user = getCurrentUser();
    const input = document.getElementById('petFeedInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    if (user.stars < amount) { showToast('❌ Недостаточно звёзд'); return; }
    const stage = user.petStage || 1;
    const threshold = thresholdForStage(stage);
    const maxFeed = threshold - user.petProgress;
    if (amount > maxFeed && threshold > 0) {
        showToast(`❌ Максимум ${maxFeed} ⭐`);
        return;
    }
    user.stars -= amount;
    user.petProgress += amount;

    if (threshold > 0 && user.petProgress >= threshold) {
        user.petProgress -= threshold;
        if (stage === 1) {
            user.stars += 200;
            user.petStage = 2;
            showToast('🎁 Стадия 2! +200 ⭐');
        } else if (stage === 2) {
            user.stars += 800;
            user.petStage = 3;
            showToast('🎁 Стадия 3! +800 ⭐');
        } else if (stage === 3) {
            user.stars += 1000;
            user.petStage = 'giant';
            showToast('🎁 Гигант! +1000 ⭐');
        }
    } else {
        showToast(`🪳 Прогресс: ${user.petProgress}/${threshold} ⭐`);
    }
    closeModal();
    render();
};

// ============================================================
//  ПОКУПКА ПОПЫТОК
// ============================================================

function handleBuy() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    openModal('🛒 Покупка попыток', `
        <p>Ваш баланс: <strong>${user.stars}</strong> ⭐</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn primary" onclick="buyAttempts(1, 100)" style="flex:1;">1 попытка — 100⭐</button>
            <button class="btn primary" onclick="buyAttempts(2, 180)" style="flex:1;">2 — 180⭐</button>
            <button class="btn primary" onclick="buyAttempts(4, 340)" style="flex:1;">4 — 340⭐</button>
        </div>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.buyAttempts = function(count, price) {
    const user = getCurrentUser();
    if (user.stars < price) { showToast('❌ Недостаточно звёзд'); return; }
    user.stars -= price;
    user.attempts += count;
    closeModal();
    showToast(`✅ Куплено ${count} попыток`);
    render();
};

// ============================================================
//  КОДЫ
// ============================================================

function handleCode() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    openModal('🎫 Ввести код', `
        <p>Введите код для активации бонуса:</p>
        <input type="text" id="codeInput" placeholder="Код" style="text-transform:uppercase;width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="applyCode()">✅ Активировать</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.applyCode = function() {
    const user = getCurrentUser();
    const input = document.getElementById('codeInput');
    if (!input) return;
    const text = input.value.trim().toUpperCase();
    if (!text) { showToast('❌ Введите код'); return; }

    let found = false;
    for (const code of boosterCodes) {
        if (code.toUpperCase() === text) {
            boosterCodes.delete(code);
            user.attempts += 1;
            user.boosted = true;
            const idx = adminCodes.findIndex(item => item.code.toUpperCase() === text);
            if (idx !== -1) adminCodes.splice(idx, 1);
            found = true;
            closeModal();
            showToast('🚀 Бустер активирован!');
            render();
            return;
        }
    }
    for (const code in boosterMultiCodes) {
        if (code.toUpperCase() === text) {
            if (boosterMultiCodes[code].usedUsers.has(user.uid)) {
                showToast('❌ Уже использован');
                return;
            }
            user.attempts += 1;
            user.boosted = true;
            boosterMultiCodes[code].usedUsers.add(user.uid);
            boosterMultiCodes[code].remaining--;
            if (boosterMultiCodes[code].remaining <= 0) {
                const idx = adminCodes.findIndex(item => item.code.toUpperCase() === text);
                if (idx !== -1) adminCodes.splice(idx, 1);
                delete boosterMultiCodes[code];
            }
            found = true;
            closeModal();
            showToast('🚀 Бустер активирован!');
            render();
            return;
        }
    }
    for (const code of oneTimeCodes) {
        if (code.toUpperCase() === text) {
            oneTimeCodes.delete(code);
            user.attempts += 1;
            const idx = adminCodes.findIndex(item => item.code.toUpperCase() === text);
            if (idx !== -1) adminCodes.splice(idx, 1);
            found = true;
            closeModal();
            showToast('✅ Код принят!');
            render();
            return;
        }
    }
    for (const code in multiUseCodes) {
        if (code.toUpperCase() === text) {
            if (multiUseCodes[code].usedUsers.has(user.uid)) {
                showToast('❌ Уже использован');
                return;
            }
            user.attempts += 1;
            multiUseCodes[code].usedUsers.add(user.uid);
            multiUseCodes[code].remaining--;
            if (multiUseCodes[code].remaining <= 0) {
                const idx = adminCodes.findIndex(item => item.code.toUpperCase() === text);
                if (idx !== -1) adminCodes.splice(idx, 1);
                delete multiUseCodes[code];
            }
            found = true;
            closeModal();
            showToast('✅ Код принят!');
            render();
            return;
        }
    }
    if (!found) showToast('❌ Неверный код');
};

// ============================================================
//  БАНК
// ============================================================

function handleBank() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    updateBankInterest(user);
    const bank = user.bank || 0;
    const deposit = user.bankDeposit || 0;
    if (bank > 0) {
        openModal('🏦 Банк (20% в час)', `
            <p>💰 В банке: <strong>${bank}</strong> ⭐</p>
            <p>📊 Первоначальный вклад: <strong>${deposit}</strong> ⭐</p>
            <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
            <button class="btn primary full" onclick="withdrawBank()">💰 Забрать все ⭐</button>
            <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
        `);
    } else {
        openModal('🏦 Банк (20% в час)', `
            <p>Банк пуст.</p>
            <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
            <input type="number" id="bankDepositInput" placeholder="Сумма для вклада" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
            <button class="btn primary full" onclick="depositBank()">💵 Положить в банк</button>
            <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
        `);
    }
}

window.withdrawBank = function() {
    const user = getCurrentUser();
    const amount = user.bank || 0;
    if (amount <= 0) { showToast('❌ Банк пуст'); return; }
    user.stars += amount;
    user.bank = 0;
    user.bankDeposit = 0;
    closeModal();
    showToast(`✅ Забрано ${amount} ⭐ из банка`);
    render();
};

window.depositBank = function() {
    const user = getCurrentUser();
    const input = document.getElementById('bankDepositInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    if (user.stars < amount) { showToast('❌ Недостаточно звёзд'); return; }
    user.stars -= amount;
    user.bank = amount;
    user.bankDeposit = amount;
    closeModal();
    showToast(`✅ ${amount} ⭐ положены в банк под 20% в час`);
    render();
};

// ============================================================
//  ТАБЛИЦА ЛИДЕРОВ
// ============================================================

function handleLeaderboard() {
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
        return;
    }
    fetch(SERVER_URL + '/api/all_users')
        .then(res => res.json())
        .then(data => {
            let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>ID</th><th>Имя</th><th>⭐</th></tr></thead><tbody>';
            data.sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 30).forEach((item, i) => {
                html += `<tr><td>${i+1}</td><td>${item.uid}</td><td>${item.name}</td><td>${item.stars}</td></tr>`;
            });
            html += '</tbody></table><button class="btn full small" onclick="closeModal();">🏠 В меню</button>';
            openModal('🏆 Таблица лидеров', html);
        })
        .catch(() => showToast('❌ Ошибка загрузки'));
}

// ============================================================
//  ПРАВИЛА
// ============================================================

function handleRules() {
    openModal('📜 Правила', `
        <div class="scrollable">
            <p><strong>🎰 Колесо удачи</strong></p>
            <p>• 1 сектор "Ничего" (60% шанс)</p>
            <p>• 9 призовых секторов (40% шанс)</p>
            <p>• Призы: 10⭐, 25⭐, 50⭐, 100⭐, 150⭐, 200⭐, 300⭐, 500⭐, 1000⭐</p>
            <br>
            <p><strong>🏦 Банк</strong></p>
            <p>• 20% в час от первоначальной суммы</p>
            <br>
            <p><strong>⭐ Кликер</strong></p>
            <p>• 400 кликов → +20 ⭐</p>
            <br>
            <p><strong>🪳 Питомец</strong></p>
            <p>• Растёт от кормления звёздами</p>
            <p>• Приносит пассивный доход</p>
            <br>
            <p><strong>🎫 Коды</strong></p>
            <p>• Вводите коды для бонусов</p>
            <br>
            <p><strong>👑 Администратор всегда прав!</strong></p>
        </div>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

// ============================================================
//  ПОДДЕРЖКА
// ============================================================

function handleSupport() {
    const user = getCurrentUser();
    const userId = user.uid;

    if (activeChats[userId]) {
        activeChats[userId].hasNew = false;
        render();
        showChatWindow(userId);
        return;
    }

    openModal('🆘 Поддержка', `
        <p>Опишите вашу проблему:</p>
        <input type="text" id="supportInput" placeholder="Ваше сообщение..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="sendSupport()">📤 Отправить</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.sendSupport = function() {
    const input = document.getElementById('supportInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('❌ Введите сообщение'); return; }
    const user = getCurrentUser();
    const userId = user.uid;

    reports.push({ uid: userId, username: user.name || 'No name', text: text, time: new Date().toLocaleString() });

    if (!activeChats[userId]) {
        activeChats[userId] = { messages: [], admin: false, hasNew: false };
    }
    activeChats[userId].messages.push({ from: 'user', text: text, time: new Date().toLocaleString() });

    closeModal();
    showToast('✅ Сообщение отправлено администратору!');
    render();

    setTimeout(() => showChatWindow(userId), 500);
};

function showChatWindow(userId) {
    const chat = activeChats[userId];
    if (!chat) { showToast('❌ Чат не найден'); return; }
    chat.hasNew = false;
    render();

    let messagesHtml = '';
    chat.messages.forEach(msg => {
        const cls = msg.from === 'user' ? 'user' : 'admin';
        const label = msg.from === 'user' ? 'Вы' : 'Админ';
        messagesHtml += `<div class="msg ${cls}"><strong>${label}:</strong> ${msg.text}<span class="time">${msg.time}</span></div>`;
    });

    const isAdmin = chat.admin || false;
    const adminControls = isAdmin ? 
        `<button class="btn danger full" onclick="closeChat('${userId}')">🔒 Завершить чат</button>` :
        `<p style="font-size:12px;color:#888;">✉️ Ожидайте ответа администратора</p>`;

    const user = getUserByUid(userId);
    const name = user ? user.name || userId : userId;

    openModal(`💬 Чат с поддержкой (${name})`, `
        <div class="chat-container" id="chatContainer">${messagesHtml || '<p style="color:#888;text-align:center;">Нет сообщений</p>'}</div>
        <div style="display:flex;gap:8px;">
            <input type="text" id="chatInput" placeholder="Введите сообщение..." style="flex:1;" />
            <button class="btn primary" onclick="sendChatMessage('${userId}')">📤</button>
        </div>
        ${adminControls}
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.sendChatMessage = function(userId) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('❌ Введите сообщение'); return; }
    const chat = activeChats[userId];
    if (!chat) { showToast('❌ Чат не найден'); return; }
    chat.messages.push({ from: 'user', text: text, time: new Date().toLocaleString() });
    if (!chat.admin) showToast('✅ Сообщение отправлено. Ожидайте ответа.');
    closeModal();
    showChatWindow(userId);
    render();
};

window.adminOpenChat = function(uid) {
    if (!activeChats[uid]) activeChats[uid] = { messages: [], admin: false, hasNew: false };
    activeChats[uid].admin = true;
    showAdminChat(uid);
    render();
};

window.adminSendMessage = function(uid) {
    const input = document.getElementById('adminChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { showToast('❌ Введите сообщение'); return; }
    if (!activeChats[uid]) activeChats[uid] = { messages: [], admin: false, hasNew: false };
    activeChats[uid].admin = true;
    activeChats[uid].messages.push({ from: 'admin', text: text, time: new Date().toLocaleString() });
    activeChats[uid].hasNew = true;
    render();
    showToast('✅ Сообщение отправлено игроку');
    closeModal();
    showAdminChat(uid);
    render();
};

function showAdminChat(uid) {
    const chat = activeChats[uid];
    if (!chat) { showToast('❌ Чат не найден'); return; }
    let messagesHtml = '';
    chat.messages.forEach(msg => {
        const cls = msg.from === 'user' ? 'user' : 'admin';
        const label = msg.from === 'user' ? 'Игрок' : 'Админ';
        messagesHtml += `<div class="msg ${cls}"><strong>${label}:</strong> ${msg.text}<span class="time">${msg.time}</span></div>`;
    });
    const user = getUserByUid(uid);
    const name = user ? user.name || uid : uid;
    openModal(`💬 Чат с игроком (${name} | ID: ${uid})`, `
        <div class="chat-container" id="adminChatContainer">${messagesHtml || '<p style="color:#888;text-align:center;">Нет сообщений</p>'}</div>
        <div style="display:flex;gap:8px;">
            <input type="text" id="adminChatInput" placeholder="Введите сообщение..." style="flex:1;" />
            <button class="btn primary" onclick="adminSendMessage('${uid}')">📤</button>
        </div>
        <button class="btn danger full" onclick="closeChat('${uid}')">🔒 Завершить чат</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.closeChat = function(uid) {
    if (activeChats[uid]) {
        delete activeChats[uid];
        closeModal();
        showToast('✅ Чат завершён');
        render();
    }
};

// ============================================================
//  АДМИН-ПАНЕЛЬ
// ============================================================

function handleAdmin() {
    openModal('🔧 Админ-панель', `
        <p>Введите пароль:</p>
        <input type="password" id="adminPassword" placeholder="Пароль" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="adminLogin()">🔑 Войти</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.adminLogin = function() {
    const input = document.getElementById('adminPassword');
    if (!input) return;
    const pass = input.value.trim();
    if (pass !== 'Qw12') { showToast('❌ Неверный пароль'); return; }
    showAdminPanel();
};

function showAdminPanel() {
    let chatList = '';
    const chatKeys = Object.keys(activeChats);
    if (chatKeys.length > 0) {
        chatList = '<p><strong>Активные чаты:</strong></p><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">';
        chatKeys.forEach(uid => {
            const user = getUserByUid(uid);
            const name = user ? user.name || uid : uid;
            const hasNew = activeChats[uid].hasNew ? ' 🔔' : '';
            chatList += `<button class="btn small" onclick="adminOpenChat('${uid}')" style="margin:2px;">💬 ${name}${hasNew}</button>`;
        });
        chatList += '</div>';
    }

    const contestStatus = contestActive ? 
        `<span style="color:#ffd700;">🟢 Активен (${Math.floor((contestEndTime - Date.now()) / 60000)} мин)</span>` : 
        `<span style="color:#888;">🔴 Не активен</span>`;

    openModal('🔧 Панель управления', `
        <div class="admin-panel">
            <p><strong>🏆 Конкурс:</strong> ${contestStatus}</p>
            <div style="display:flex;gap:8px;">
                <button class="btn primary small" onclick="startContest()">🏆 Запустить</button>
                <button class="btn danger small" onclick="forceEndContest()">⏹ Завершить</button>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;" />
            ${chatList}
            <hr style="border-color:rgba(255,255,255,0.1);margin:12px 0;" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn small" onclick="adminCodeSingle()">🔑 Код 1</button>
                <button class="btn small" onclick="adminCodeMulti()">🔑 Код 5</button>
                <button class="btn small" onclick="adminBoostSingle()">🚀 Бустер</button>
                <button class="btn small" onclick="adminBoostMulti()">🚀 Бустер x5</button>
                <button class="btn small" onclick="adminSendCodeToPlayer()">📤 Отправить код</button>
                <button class="btn small" onclick="adminSendCodeToAll()">📤 Всем игрокам</button>
                <button class="btn small" onclick="adminMassGive()">🎮 Попытки всем</button>
                <button class="btn small" onclick="adminGiveSelfStars()">⭐ Звёзды себе</button>
                <button class="btn small" onclick="adminPlayerMenu()">👤 Игроки</button>
                <button class="btn small danger" onclick="adminReports()">📩 Жалобы</button>
                <button class="btn small" onclick="adminTop()">🏆 Топ-30</button>
            </div>
            <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
        </div>
    `);
}

// ============================================================
//  АДМИН-ФУНКЦИИ
// ============================================================

window.adminCodeSingle = function() {
    const code = generateCode(10);
    oneTimeCodes.add(code);
    adminCodes.push({ code: code, type: '🔑 Одноразовый' });
    showToast(`✅ Код: ${code}`);
    render();
};

window.adminCodeMulti = function() {
    const code = generateCode(10);
    multiUseCodes[code] = { remaining: 5, usedUsers: new Set() };
    adminCodes.push({ code: code, type: '🔑 На 5' });
    showToast(`✅ Код на 5: ${code}`);
    render();
};

window.adminBoostSingle = function() {
    const code = generateCode(16);
    boosterCodes.add(code);
    adminCodes.push({ code: code, type: '🚀 Бустер' });
    showToast(`✅ Бустер: ${code}`);
    render();
};

window.adminBoostMulti = function() {
    const code = generateCode(16);
    boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() };
    adminCodes.push({ code: code, type: '🚀 Бустер x5' });
    showToast(`✅ Бустер на 5: ${code}`);
    render();
};

window.adminSendCodeToPlayer = function() {
    openModal('📤 Отправить код игроку', `
        <p>Введите ID игрока:</p>
        <input type="text" id="sendCodeUid" placeholder="UID игрока" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <p>Выберите тип кода:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn small" onclick="sendCodeToPlayerWithType('single')">🔑 Одноразовый</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('multi')">🔑 На 5</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('boost')">🚀 Бустер</button>
            <button class="btn small" onclick="sendCodeToPlayerWithType('boostmulti')">🚀 Бустер x5</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.sendCodeToPlayerWithType = function(type) {
    const uidInput = document.getElementById('sendCodeUid');
    if (!uidInput) return;
    const uid = uidInput.value.trim();
    if (!uid) { showToast('❌ Введите ID игрока'); return; }
    const user = getUserByUid(uid);
    if (!user) { showToast('❌ Игрок не найден'); return; }

    let code, typeLabel;
    switch(type) {
        case 'single': code = generateCode(10); oneTimeCodes.add(code); typeLabel = '🔑 Одноразовый'; break;
        case 'multi': code = generateCode(10); multiUseCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = '🔑 На 5'; break;
        case 'boost': code = generateCode(16); boosterCodes.add(code); typeLabel = '🚀 Бустер'; break;
        case 'boostmulti': code = generateCode(16); boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = '🚀 Бустер x5'; break;
    }

    adminCodes.push({ code: code, type: typeLabel + ' → ' + uid, target: uid });
    addNotification(uid, `🎫 Вам отправлен код: ${code} (${typeLabel})`);
    if (activeChats[uid]) {
        activeChats[uid].messages.push({ from: 'admin', text: `🎫 Вам отправлен код: ${code} (${typeLabel})`, time: new Date().toLocaleString() });
        activeChats[uid].hasNew = true;
    }
    closeModal();
    showToast(`✅ Код отправлен игроку ${uid}`);
    render();
    showAdminPanel();
};

window.adminSendCodeToAll = function() {
    openModal('📤 Отправить код всем игрокам', `
        <p>Выберите тип кода:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn small" onclick="sendCodeToAllWithType('single')">🔑 Одноразовый</button>
            <button class="btn small" onclick="sendCodeToAllWithType('multi')">🔑 На 5</button>
            <button class="btn small" onclick="sendCodeToAllWithType('boost')">🚀 Бустер</button>
            <button class="btn small" onclick="sendCodeToAllWithType('boostmulti')">🚀 Бустер x5</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.sendCodeToAllWithType = function(type) {
    let code, typeLabel;
    switch(type) {
        case 'single': code = generateCode(10); oneTimeCodes.add(code); typeLabel = '🔑 Одноразовый'; break;
        case 'multi': code = generateCode(10); multiUseCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = '🔑 На 5'; break;
        case 'boost': code = generateCode(16); boosterCodes.add(code); typeLabel = '🚀 Бустер'; break;
        case 'boostmulti': code = generateCode(16); boosterMultiCodes[code] = { remaining: 5, usedUsers: new Set() }; typeLabel = '🚀 Бустер x5'; break;
    }

    const userKeys = Object.keys(uidMap);
    for (const uid of userKeys) {
        if (bannedUsers[uid]) continue;
        addNotification(uid, `🎫 Всем игрокам: ${code} (${typeLabel})`);
        if (activeChats[uid]) {
            activeChats[uid].messages.push({ from: 'admin', text: `🎫 Всем игрокам: ${code} (${typeLabel})`, time: new Date().toLocaleString() });
            activeChats[uid].hasNew = true;
        }
    }
    adminCodes.push({ code: code, type: typeLabel + ' (всем)', target: 'всем' });
    closeModal();
    showToast(`✅ Код отправлен всем игрокам`);
    render();
    showAdminPanel();
};

window.adminMassGive = function() {
    for (const uid in uidMap) {
        if (bannedUsers[uid]) continue;
        const user = getUserByUid(uid);
        if (user) user.attempts = 1;
    }
    showToast('✅ Попытки выданы всем активным игрокам');
};

window.adminGiveSelfStars = function() {
    openModal('⭐ Начислить звёзды себе', `
        <input type="number" id="selfStarsInput" placeholder="Сумма" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="doGiveSelfStars()">✅ Начислить</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.doGiveSelfStars = function() {
    const input = document.getElementById('selfStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    const user = getCurrentUser();
    user.stars += amount;
    closeModal();
    showToast(`✅ +${amount} ⭐`);
    render();
    showAdminPanel();
};

window.adminPlayerMenu = function() {
    openModal('👤 Управление игроком', `
        <p>Введите ID игрока:</p>
        <input type="text" id="playerUidInput" placeholder="UID игрока" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="showPlayerInfo()">🔍 Найти</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.showPlayerInfo = function() {
    const input = document.getElementById('playerUidInput');
    if (!input) return;
    const uid = input.value.trim();
    if (!uid) { showToast('❌ Введите ID'); return; }
    const user = getUserByUid(uid);
    if (!user) { showToast('❌ Игрок не найден'); return; }

    const isBanned = bannedUsers[uid] !== undefined;
    const banReason = bannedUsers[uid] || '—';
    const name = user.name || '—';
    const gender = user.gender || '—';
    const age = user.age || '—';
    const stars = user.stars || 0;
    const bank = user.bank || 0;
    const attempts = user.attempts || 0;
    const coeff = user.coefficientRate || 0;
    const clickerProgress = user.clickerProgress || 0;

    openModal(`👤 Игрок: ${name} (${uid})`, `
        <p><strong>📊 Статистика:</strong></p>
        <p>👤 Имя: ${name}</p>
        <p>⚧ Пол: ${gender}</p>
        <p>🎂 Возраст: ${age}</p>
        <p>⭐ Звёзды: ${stars}</p>
        <p>🏦 Банк: ${bank}</p>
        <p>🎮 Попытки: ${attempts}</p>
        <p>🔥 Коэффициент: +${coeff}</p>
        <p>⭐ Кликер: ${clickerProgress}/400</p>
        <p>🚫 Статус: ${isBanned ? '❌ ЗАБЛОКИРОВАН' : '✅ Активен'}</p>
        ${isBanned ? `<p style="color:#ff4757;">📝 Причина: ${banReason}</p>` : ''}
        <hr />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn small" onclick="adminAddStars('${uid}')">⭐ + Звёзды</button>
            <button class="btn small danger" onclick="adminRemoveStars('${uid}')">⭐ - Звёзды</button>
            ${isBanned ? 
                `<button class="btn small" onclick="adminUnbanUserByUid('${uid}')">✅ Разбан</button>` :
                `<button class="btn small danger" onclick="adminBanUserByUid('${uid}')">🚫 Бан</button>`
            }
            <button class="btn small" onclick="adminOpenChat('${uid}')">💬 Чат</button>
            <button class="btn small" onclick="adminResetPlayer('${uid}')">🔄 Сброс</button>
        </div>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.adminAddStars = function(uid) {
    openModal(`⭐ Добавить звёзды игроку ${uid}`, `
        <input type="number" id="addStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="doAddStars('${uid}')">✅ Добавить</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">⬅️ Назад</button>
    `);
};

window.doAddStars = function(uid) {
    const input = document.getElementById('addStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    const user = getUserByUid(uid);
    if (user) {
        user.stars += amount;
        addNotification(uid, `⭐ Администратор начислил вам ${amount} ⭐`);
        showToast(`✅ +${amount} ⭐ игроку ${uid}`);
        closeModal();
        showPlayerInfo();
        render();
    }
};

window.adminRemoveStars = function(uid) {
    openModal(`⭐ Забрать звёзды у игрока ${uid}`, `
        <input type="number" id="removeStarsInput" placeholder="Количество" min="1" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn danger full" onclick="doRemoveStars('${uid}')">✅ Забрать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">⬅️ Назад</button>
    `);
};

window.doRemoveStars = function(uid) {
    const input = document.getElementById('removeStarsInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    const user = getUserByUid(uid);
    if (user) {
        if (user.stars < amount) { showToast('❌ Недостаточно звёзд у игрока'); return; }
        user.stars -= amount;
        addNotification(uid, `⭐ Администратор забрал у вас ${amount} ⭐`);
        showToast(`✅ Изъято ${amount} ⭐ у игрока ${uid}`);
        closeModal();
        showPlayerInfo();
        render();
    }
};

window.adminBanUserByUid = function(uid) {
    openModal(`🚫 Блокировка игрока ${uid}`, `
        <p>Введите причину блокировки:</p>
        <input type="text" id="banReasonInput" placeholder="Причина блокировки..." style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn danger full" onclick="doBanUser('${uid}')">🚫 Заблокировать</button>
        <button class="btn full small" onclick="closeModal(); showPlayerInfo();">⬅️ Назад</button>
    `);
};

window.doBanUser = function(uid) {
    const input = document.getElementById('banReasonInput');
    if (!input) return;
    const reason = input.value.trim() || 'Нарушение правил';
    bannedUsers[uid] = reason;
    addNotification(uid, `🚫 Вас заблокировали. Причина: ${reason}`);
    showToast(`✅ ${uid} заблокирован. Причина: ${reason}`);
    closeModal();
    showPlayerInfo();
    render();
};

window.adminUnbanUserByUid = function(uid) {
    if (bannedUsers[uid]) {
        delete bannedUsers[uid];
        addNotification(uid, '✅ Вас разблокировали!');
        showToast(`✅ ${uid} разблокирован`);
        closeModal();
        showPlayerInfo();
        render();
    }
};

window.adminResetPlayer = function(uid) {
    if (!confirm(`Вы уверены, что хотите сбросить игрока ${uid}?`)) return;
    const user = getUserByUid(uid);
    if (user) {
        user.stars = 300;
        user.bank = 0;
        user.bankDeposit = 0;
        user.attempts = 1;
        user.coefficientRate = 0;
        user.petProgress = 0;
        user.petStage = 1;
        user.wins = [];
        user.clickerProgress = 0;
        addNotification(uid, '🔄 Ваш прогресс был сброшен администратором');
        showToast(`✅ Игрок ${uid} сброшен`);
        closeModal();
        render();
        showAdminPanel();
    }
};

window.adminReports = function() {
    if (reports.length === 0 && Object.keys(activeChats).length === 0) {
        showToast('📭 Жалоб и чатов нет');
        return;
    }

    let text = '📩 Жалобы:\n\n';
    const last = reports.slice(-10);
    for (const r of last) {
        text += `От ${r.username} (ID: ${r.uid}) [${r.time}]:\n${r.text}\n\n`;
    }

    let chatButtons = '';
    const chatKeys = Object.keys(activeChats);
    if (chatKeys.length > 0) {
        chatButtons = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0;">';
        chatKeys.forEach(uid => {
            const user = getUserByUid(uid);
            const name = user ? user.name || uid : uid;
            chatButtons += `<button class="btn small" onclick="adminOpenChat('${uid}')">💬 ${name}</button>`;
        });
        chatButtons += '</div>';
    }

    openModal('📩 Жалобы и чаты', `
        <div class="scrollable"><pre style="color:#c0c0e0;font-family:inherit;white-space:pre-wrap;font-size:14px;">${text}</pre></div>
        ${chatButtons}
        <button class="btn danger full" onclick="reports=[]; closeModal(); showToast('✅ Жалобы очищены'); showAdminPanel();">🗑️ Очистить жалобы</button>
        <button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>
    `);
};

window.adminTop = function() {
    fetch(SERVER_URL + '/api/all_users')
        .then(res => res.json())
        .then(data => {
            let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>ID</th><th>Имя</th><th>⭐</th></tr></thead><tbody>';
            data.sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 30).forEach((item, i) => {
                html += `<tr><td>${i+1}</td><td>${item.uid}</td><td>${item.name}</td><td>${item.stars}</td></tr>`;
            });
            html += '</tbody></table><button class="btn full small" onclick="closeModal(); showAdminPanel();">⬅️ Назад</button>';
            openModal('🏆 Топ-30', html);
        })
        .catch(() => showToast('❌ Ошибка загрузки'));
};

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================

function checkRegistration() {
    const user = getCurrentUser();
    if (!user.registered) {
        showRegistration();
    }
}

let regData = { name: '', gender: '', age: '' };
let genderSelected = false;

function showRegistration() {
    openModal('📝 Регистрация', `
        <p>Добро пожаловать! Давайте зарегистрируемся.</p>
        <p>Введите ваше имя:</p>
        <input type="text" id="regName" placeholder="Имя" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <p>Выберите пол:</p>
        <div style="display:flex;gap:8px;margin:5px 0;">
            <button class="btn" onclick="selectGender('Мужской')" style="flex:1;">👨 Мужской</button>
            <button class="btn" onclick="selectGender('Женский')" style="flex:1;">👩 Женский</button>
        </div>
        <p>Введите возраст:</p>
        <input type="number" id="regAge" placeholder="Возраст" min="1" max="120" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" onclick="completeRegistration()">✅ Завершить</button>
    `);
}

window.selectGender = function(g) {
    genderSelected = true;
    regData.gender = g;
    showToast(`✅ Пол: ${g}`);
};

window.completeRegistration = function() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
    if (!nameInput || !ageInput) return;
    
    regData.name = nameInput.value.trim();
    regData.age = parseInt(ageInput.value);

    if (!regData.name || regData.name.length === 0) {
        showToast('❌ Введите имя');
        return;
    }
    if (!regData.age || regData.age < 1 || regData.age > 120) {
        showToast('❌ Введите возраст от 1 до 120');
        return;
    }
    if (!regData.gender) {
        showToast('❌ Выберите пол');
        return;
    }

    const user = getCurrentUser();
    user.name = regData.name;
    user.gender = regData.gender;
    user.age = regData.age;
    user.registered = true;
    closeModal();
    showToast('✅ Регистрация завершена!');
    render();
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM загружен!');
    
    document.getElementById('btnPlay').addEventListener('click', function() {
        console.log('🎮 Играть');
        const user = getCurrentUser();
        if (!user.registered) {
            showToast('❌ Сначала зарегистрируйтесь!');
            return;
        }
        if (user.attempts <= 0) {
            showToast('❌ Попыток нет! Купите в меню.');
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
        await loadFromServer();
        setTimeout(checkRegistration, 500);
    }, 500);
    
    console.log('✅ Все обработчики назначены!');
});

setInterval(() => {
    const user = getCurrentUser();
    if (user.registered) {
        saveToServer();
    }
}, 15000);
