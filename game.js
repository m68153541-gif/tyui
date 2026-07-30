// ============================================================
//  ПОЛНАЯ ЛОГИКА ИГРЫ + СЕРВЕР (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================================

console.log('🚀 Игра загружается...');

// ---------- ПРИВЯЗКА К TELEGRAM ----------
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
    
    let userId = localStorage.getItem('telegram_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('telegram_user_id', userId);
    }
    return userId;
}

// ---------- ХРАНИЛИЩЕ ----------
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
let userDataLoaded = false;

// ---------- ОСНОВНЫЕ ФУНКЦИИ ----------
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
        saveToServer();
    }
    return users[userId];
}

function getCurrentUser() {
    const userId = getTelegramUserId();
    return getUser(userId);
}

function getUserByUid(uid) {
    const userId = uidMap[uid];
    if (userId) return getUser(userId);
    return null;
}

// ---------- СОХРАНЕНИЕ ----------
async function saveToServer() {
    try {
        const user = getCurrentUser();
        const response = await fetch(SERVER_URL + '/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: user.uid, 
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
        const user = getCurrentUser();
        const response = await fetch(SERVER_URL + `/api/load/${user.uid}`);
        if (response.ok) {
            const data = await response.json();
            const oldUid = user.uid;
            Object.assign(user, data);
            user.uid = oldUid;
            console.log('✅ Загружено с сервера:', data);
            render();
            return true;
        }
    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
    }
    return false;
}

// ---------- ОБНОВЛЕНИЯ ----------
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

// ---------- ОТРИСОВКА ----------
function render() {
    console.log('🔄 Рендеринг...');
    const user = getCurrentUser();
    updatePassiveIncome(user);
    updateBankInterest(user);

    const userName = document.getElementById('userName');
    const userGender = document.getElementById('userGender');
    const userAge = document.getElementById('userAge');
    const userUid = document.getElementById('userUid');
    const userAttempts = document.getElementById('userAttempts');
    const userRegStatus = document.getElementById('userRegStatus');
    const starsBalance = document.getElementById('starsBalance');
    const bankBalance = document.getElementById('bankBalance');
    const petStage = document.getElementById('petStage');
    const petProgress = document.getElementById('petProgress');

    if (userName) userName.textContent = user.name || '—';
    if (userGender) userGender.textContent = user.gender || '—';
    if (userAge) userAge.textContent = user.age || '—';
    if (userUid) userUid.textContent = user.uid || '—';
    if (userAttempts) userAttempts.textContent = user.attempts || 0;
    
    if (userRegStatus) {
        if (bannedUsers[user.uid]) {
            userRegStatus.textContent = '🚫 ЗАБЛОКИРОВАН: ' + bannedUsers[user.uid];
            userRegStatus.style.color = '#ff4757';
        } else {
            userRegStatus.textContent = user.registered ? '✅ Зарегистрирован' : '❌ Не зарегистрирован';
            userRegStatus.style.color = '#c8c8ff';
        }
    }

    if (starsBalance) starsBalance.textContent = user.stars || 0;
    if (bankBalance) bankBalance.textContent = user.bank || 0;

    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    let stageText = '';
    if (stage === 1) stageText = 'Малыш';
    else if (stage === 2) stageText = 'Подросток';
    else if (stage === 3) stageText = 'Взрослый';
    else stageText = 'Гигант 👑';
    if (petStage) petStage.textContent = '🪳 ' + stageText;
    if (petProgress) petProgress.textContent = `${progress} / ${threshold} ⭐`;

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
    saveToServer();
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
            saveToServer();
        }
    } else {
        showToast('❌ Нет участников для конкурса');
    }
    render();
    saveToServer();
}

function forceEndContest() {
    if (!contestActive) { showToast('❌ Конкурс не запущен'); return; }
    endContest();
}

// ---------- TOAST ----------
let toastTimeout;

function showToast(text, duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
}

// ---------- МОДАЛКА ----------
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

// ---------- КОПИРОВАНИЕ ----------
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
    saveToServer();
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
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.attempts <= 0) {
        showToast('❌ Попыток нет! Купите в меню.');
        return;
    }

    isSpinning = true;
    const spinBtn = document.getElementById('wheelSpinBtn');
    if (spinBtn) spinBtn.disabled = true;
    const resultEl = document.getElementById('wheelResult');
    if (resultEl) resultEl.textContent = '🔄 Крутим...';

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
            if (spinBtn) spinBtn.disabled = false;
            render();
            saveToServer();
        }
    }, 30);
}

function showWheelResult(result, user) {
    const resultDiv = document.getElementById('wheelResult');
    const coeff = user.coefficientRate || 0;

    if (result.value === 0) {
        if (resultDiv) resultDiv.innerHTML = `<span>😔</span><span>К сожалению, ничего не выиграно!</span>`;
        showToast('😔 Ничего не выиграно');
        return;
    }

    let finalValue = result.value;
    if (coeff > 0) finalValue = Math.round(result.value + coeff);

    user.stars += finalValue;
    user.wins.push({
        id: user.wins.length + 1,
        type: result.label,
        amount: finalValue,
        timestamp: new Date().toLocaleString(),
        status: 'won'
    });

    if (resultDiv) {
        resultDiv.innerHTML = `
            <span style="font-size:40px;">${result.icon}</span>
            <span class="highlight">+${finalValue} ⭐</span>
            <span style="font-size:14px;color:#aaa;">(${result.label})</span>
            ${coeff > 0 ? `<span style="font-size:12px;color:#6bcbff;">коэфф: +${coeff}</span>` : ''}
        `;
    }
    showToast(`🎉 +${finalValue} ⭐ (${result.label})`);
    render();
    saveToServer();
}

function openWheel() {
    const overlay = document.getElementById('wheelOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    const resultEl = document.getElementById('wheelResult');
    if (resultEl) resultEl.innerHTML = 'Нажмите "Крутить"!';
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    currentAngle = 0;
    drawWheel();
    const user = getCurrentUser();
    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;
}

function closeWheel() {
    const overlay = document.getElementById('wheelOverlay');
    if (overlay) overlay.classList.remove('active');
}

// ============================================================
//  ОБРАБОТЧИКИ
// ============================================================

function handlePlay() {
    console.log('🎮 Нажата кнопка Играть');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.attempts <= 0) {
        showToast('❌ Попыток нет! Купите в меню.');
        return;
    }
    openWheel();
}

function handleBank() {
    console.log('🏦 Нажата кнопка Банк');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
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
            <button class="btn full small" onclick="closeModal(); render();">🏠 В меню</button>
        `);
    } else {
        openModal('🏦 Банк (20% в час)', `
            <p>Банк пуст.</p>
            <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
            <input type="number" id="bankDepositInput" placeholder="Сумма для вклада" min="1" />
            <button class="btn primary full" onclick="depositBank()">💵 Положить в банк</button>
            <button class="btn full small" onclick="closeModal(); render();">🏠 В меню</button>
        `);
    }
}

window.withdrawBank = function() {
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) { showToast('🚫 Вы заблокированы'); return; }
    const amount = user.bank || 0;
    if (amount <= 0) { showToast('❌ Банк пуст'); return; }
    user.stars += amount;
    user.bank = 0;
    user.bankDeposit = 0;
    user.bankTime = Date.now();
    closeModal();
    showToast(`✅ Забрано ${amount} ⭐ из банка`);
    render();
    saveToServer();
};

window.depositBank = function() {
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) { showToast('🚫 Вы заблокированы'); return; }
    const input = document.getElementById('bankDepositInput');
    if (!input) return;
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) { showToast('❌ Введите сумму'); return; }
    if (user.stars < amount) { showToast('❌ Недостаточно звёзд'); return; }
    user.stars -= amount;
    user.bank = amount;
    user.bankDeposit = amount;
    user.bankTime = Date.now();
    closeModal();
    showToast(`✅ ${amount} ⭐ положены в банк под 20% в час`);
    render();
    saveToServer();
};

function handleClicker() {
    console.log('⭐ Нажата кнопка Кликер');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    user.clickerProgress = (user.clickerProgress || 0) + 1;
    saveToServer();
    render();
    if (user.clickerProgress >= 400) {
        user.stars += 20;
        user.clickerProgress = 0;
        saveToServer();
        render();
        showToast('🎉 +20 ⭐ за клики!');
    } else {
        showToast('⭐ Клик ' + user.clickerProgress + '/400');
    }
}

function handleCoeff() {
    console.log('🔥 Нажата кнопка Коэфф.');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    showToast('🔥 Коэффициент: +' + user.coefficientRate);
}

function handlePet() {
    console.log('🪳 Нажата кнопка Питомец');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    showToast(`🪳 Прогресс: ${progress}/${threshold}`);
}

function handleBuy() {
    console.log('🛒 Нажата кнопка Попытки');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    if (user.stars < 100) {
        showToast('❌ Нужно 100 ⭐!');
        return;
    }
    user.stars -= 100;
    user.attempts += 1;
    saveToServer();
    render();
    showToast('✅ +1 попытка!');
}

function handleCode() {
    console.log('🎫 Нажата кнопка Код');
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    showToast('🎫 Введите код в консоли: applyCode("КОД")');
}

function handleLeaderboard() {
    console.log('🏆 Нажата кнопка Лидеры');
    showToast('🏆 Таблица лидеров');
}

function handleRules() {
    console.log('📜 Нажата кнопка Правила');
    showToast('📜 Правила');
}

function handleSupport() {
    console.log('🆘 Нажата кнопка Поддержка');
    showToast('🆘 Поддержка');
}

function handleAdmin() {
    console.log('🔧 Нажата кнопка Админ');
    showToast('🔧 Админ-панель');
}

// ---------- РЕГИСТРАЦИЯ ----------
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
        <div class="flex">
            <button class="btn" id="genderMale" onclick="selectGender('Мужской')" style="flex:1;">👨 Мужской</button>
            <button class="btn" id="genderFemale" onclick="selectGender('Женский')" style="flex:1;">👩 Женский</button>
        </div>
        <p>Введите возраст:</p>
        <input type="number" id="regAge" placeholder="Возраст" min="1" max="120" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <button class="btn primary full" id="regCompleteBtn" onclick="completeRegistration()" disabled>✅ Завершить</button>
    `);
}

window.selectGender = function(g) {
    genderSelected = true;
    regData.gender = g;
    document.getElementById('genderMale').classList.toggle('selected', g === 'Мужской');
    document.getElementById('genderFemale').classList.toggle('selected', g === 'Женский');
    document.getElementById('genderMale').disabled = true;
    document.getElementById('genderFemale').disabled = true;
    showToast(`✅ Пол: ${g}`);
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

window.completeRegistration = function() {
    const nameInput = document.getElementById('regName');
    const ageInput = document.getElementById('regAge');
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
    saveToServer();
};

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM загружен!');
    
    // Назначаем обработчики
    document.getElementById('btnPlay').addEventListener('click', handlePlay);
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
    
    // Колесо
    document.getElementById('wheelSpinBtn').addEventListener('click', spinWheel);
    document.getElementById('wheelCloseBtn').addEventListener('click', closeWheel);
    document.getElementById('wheelCanvas').addEventListener('click', spinWheel);
    
    render();
    
    // Загружаем данные с сервера
    setTimeout(loadFromServer, 500);
    
    // Проверяем регистрацию
    setTimeout(checkRegistration, 1000);
    
    console.log('✅ Все обработчики назначены!');
});

// Автосохранение каждые 15 секунд
setInterval(() => {
    const user = getCurrentUser();
    if (user.registered) {
        saveToServer();
    }
}, 15000);
