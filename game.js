// ============================================================
//  ПОЛНАЯ ЛОГИКА ИГРЫ + СЕРВЕР
// ============================================================

// ---------- Хранилище ----------
let users = {};
let uidMap = {};
let bannedUsers = {}; // { uid: reason }
let oneTimeCodes = new Set();
let multiUseCodes = {};
let boosterCodes = new Set();
let boosterMultiCodes = {};
let reports = [];
let activeChats = {};
let adminCodes = [];

// Конкурс
let contestActive = false;
let contestStartTime = null;
let contestDuration = 6 * 60 * 60 * 1000; // 6 часов
let contestWinner = null;
let contestEndTime = null;

const PASSIVE_INCOME = { 1: 0, 2: 20, 3: 50, "giant": 300 };
const SERVER_URL = window.location.origin;

// ============================================================
//  СОХРАНЕНИЕ НА СЕРВЕР
// ============================================================

async function saveToServer() {
    try {
        const user = getCurrentUser();
        if (!user.uid) return false;
        
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
        console.log('❌ Ошибка сохранения:', e);
        return false;
    }
}

async function loadFromServer() {
    try {
        const user = getCurrentUser();
        if (!user.uid) return false;
        
        const response = await fetch(SERVER_URL + `/api/load/${user.uid}`);
        if (response.ok) {
            const data = await response.json();
            // Сохраняем важные поля, не перезаписывая uid
            const oldUid = user.uid;
            Object.assign(user, data);
            user.uid = oldUid;
            render();
            console.log('✅ Загружено с сервера:', data);
            return true;
        }
    } catch(e) {
        console.log('❌ Ошибка загрузки:', e);
    }
    return false;
}

async function syncAllUsers() {
    try {
        const response = await fetch(SERVER_URL + '/api/all_users');
        if (response.ok) {
            const data = await response.json();
            // Обновляем uidMap из данных сервера
            for (const item of data) {
                if (item.uid && !uidMap[item.uid]) {
                    uidMap[item.uid] = item.uid;
                }
            }
            console.log('✅ Синхронизировано пользователей:', data.length);
            return data;
        }
    } catch(e) {
        console.log('❌ Ошибка синхронизации:', e);
    }
    return [];
}

// Автосохранение каждые 15 секунд
setInterval(() => {
    const user = getCurrentUser();
    if (user.registered && user.uid) {
        saveToServer();
    }
}, 15000);

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
        // Сохраняем нового пользователя на сервер
        setTimeout(() => saveToServer(), 500);
    }
    return users[userId];
}

function getCurrentUser() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('userId', userId);
    }
    return getUser(userId);
}

function getUserByUid(uid) {
    const userId = uidMap[uid];
    if (userId) return getUser(userId);
    return null;
}

function isBanned(uid) {
    return bannedUsers[uid] !== undefined;
}

function getBanReason(uid) {
    return bannedUsers[uid] || null;
}

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
        if (earned > 0) {
            userData.bank = (userData.bank || 0) + earned;
        }
    }
    userData.bankTime = now;
}

// ---------- Уведомления ----------
function addNotification(uid, message) {
    const user = getUserByUid(uid);
    if (user) {
        if (!user.notifications) user.notifications = [];
        user.notifications.push({
            text: message,
            time: new Date().toLocaleString(),
            read: false
        });
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

// ---------- Отрисовка ----------
function render() {
    const user = getCurrentUser();
    updatePassiveIncome(user);
    updateBankInterest(user);

    document.getElementById('userName').textContent = user.name || '—';
    document.getElementById('userGender').textContent = user.gender || '—';
    document.getElementById('userAge').textContent = user.age || '—';
    document.getElementById('userUid').textContent = user.uid || '—';
    document.getElementById('userAttempts').textContent = user.attempts || 0;
    
    const statusEl = document.getElementById('userRegStatus');
    if (bannedUsers[user.uid]) {
        statusEl.textContent = '🚫 ЗАБЛОКИРОВАН: ' + bannedUsers[user.uid];
        statusEl.style.color = '#ff4757';
    } else {
        statusEl.textContent = user.registered ? '✅ Зарегистрирован' : '❌ Не зарегистрирован';
        statusEl.style.color = '#c8c8ff';
    }

    document.getElementById('starsBalance').textContent = user.stars || 0;
    document.getElementById('bankBalance').textContent = user.bank || 0;

    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    let stageText = '';
    let emoji = '🪳';
    if (stage === 1) stageText = 'Малыш';
    else if (stage === 2) stageText = 'Подросток';
    else if (stage === 3) stageText = 'Взрослый';
    else stageText = 'Гигант 👑';
    document.getElementById('petStage').textContent = emoji + ' ' + stageText;
    document.getElementById('petProgress').textContent = `${progress} / ${threshold} ⭐`;

    const supportBtn = document.getElementById('btnSupport');
    const userId = getCurrentUser().uid;
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
    if (!contestActive) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';
    const now = Date.now();
    const remaining = contestEndTime - now;

    if (remaining <= 0) {
        endContest();
        return;
    }

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    let winnerText = '';
    if (contestWinner) {
        const winner = getUserByUid(contestWinner);
        winnerText = `
            <div class="winner">🏆 Победитель: <strong>${contestWinner}</strong></div>
        `;
    }

    banner.innerHTML = `
        <div class="title">🏆 КОНКУРС</div>
        <div class="timer">⏱ ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}</div>
        <div style="font-size:12px;color:#aaa;">Победит тот, у кого больше звёзд (баланс + банк)</div>
        ${winnerText}
    `;
}

function startContest() {
    if (contestActive) {
        showToast('❌ Конкурс уже запущен');
        return;
    }
    contestActive = true;
    contestStartTime = Date.now();
    contestEndTime = contestStartTime + contestDuration;
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
    if (!contestActive) {
        showToast('❌ Конкурс не запущен');
        return;
    }
    endContest();
}

window.copyUid = function() {
    const uid = document.getElementById('userUid').textContent;
    if (uid && uid !== '—') {
        navigator.clipboard.writeText(uid).then(() => {
            showToast('✅ ID скопирован!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = uid;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('✅ ID скопирован!');
        });
    }
};

// ---------- Toast ----------
let toastTimeout;

function showToast(text, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
}

// ---------- Модалка ----------
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
    ctx = wheelCanvas.getContext('2d');
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    drawWheel();
}

function drawWheel(highlightIndex = -1) {
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
    document.getElementById('wheelSpinBtn').disabled = true;
    document.getElementById('wheelResult').textContent = '🔄 Крутим...';

    user.attempts--;

    const roll = Math.random() * 100;
    if (roll < 60) {
        winIndex = 0;
    } else if (roll < 68) {
        winIndex = 1;
    } else if (roll < 75) {
        winIndex = 2;
    } else if (roll < 81) {
        winIndex = 3;
    } else if (roll < 86) {
        winIndex = 4;
    } else if (roll < 90) {
        winIndex = 5;
    } else if (roll < 94) {
        winIndex = 6;
    } else if (roll < 97) {
        winIndex = 7;
    } else if (roll < 99.3) {
        winIndex = 8;
    } else {
        winIndex = 9;
    }

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
            saveToServer();
        }
    }, 30);
}

function showWheelResult(result, user) {
    const resultDiv = document.getElementById('wheelResult');
    const coeff = user.coefficientRate || 0;

    if (result.value === 0) {
        resultDiv.innerHTML = `
            <span>😔</span>
            <span>К сожалению, ничего не выиграно!</span>
        `;
        showToast('😔 Ничего не выиграно');
        return;
    }

    let finalValue = result.value;
    if (coeff > 0) {
        finalValue = Math.round(result.value + coeff);
    }

    user.stars += finalValue;
    user.wins.push({
        id: user.wins.length + 1,
        type: result.label,
        amount: finalValue,
        timestamp: new Date().toLocaleString(),
        status: 'won'
    });

    resultDiv.innerHTML = `
        <span style="font-size:40px;">${result.icon}</span>
        <span class="highlight">+${finalValue} ⭐</span>
        <span style="font-size:14px;color:#aaa;">(${result.label})</span>
        ${coeff > 0 ? `<span style="font-size:12px;color:#6bcbff;">коэфф: +${coeff}</span>` : ''}
    `;

    showToast(`🎉 +${finalValue} ⭐ (${result.label})`);
    render();
    saveToServer();
}

function openWheel() {
    const overlay = document.getElementById('wheelOverlay');
    overlay.classList.add('active');
    document.getElementById('wheelResult').innerHTML = 'Нажмите "Крутить"!';
    wheelSegments = SEGMENTS.map(s => ({ ...s }));
    currentAngle = 0;
    drawWheel();
    
    const user = getCurrentUser();
    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;
}

function closeWheel() {
    document.getElementById('wheelOverlay').classList.remove('active');
}

// ============================================================
//  КЛИКЕР ЗВЁЗД
// ============================================================

function handleClicker() {
    const user = getCurrentUser();
    
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы. Причина: ' + bannedUsers[user.uid]);
        return;
    }
    
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
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
            ${progress >= 400 ? `
                <button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать ${reward} ⭐</button>
            ` : ''}
            <button class="btn full small" onclick="closeModal(); render();">🏠 В меню</button>
        </div>
    `);

    document.addEventListener('keydown', function clickerKeyHandler(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            clickStar();
        }
    });
}

window.clickStar = function() {
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
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
                container.innerHTML = `
                    <button class="btn primary full" onclick="claimClickerReward()">🎁 Забрать 20 ⭐</button>
                `;
            }
        }
        showToast('🎉 400 кликов! Заберите награду!');
    }

    render();
    saveToServer();
};

window.claimClickerReward = function() {
    const user = getCurrentUser();
    if (bannedUsers[user.uid]) {
        showToast('🚫 Вы заблокированы');
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
    saveToServer();
};

// ============================================================
//  КОДЫ АДМИНИСТРАТОРА
// ============================================================

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

function sendCodeToPlayer(uid, code, type) {
    adminCodes.push({ 
        code: code, 
        type: type + ' → ' + uid,
        target: uid
    });
    
    addNotification(uid, `🎫 Вам отправлен код: ${code} (${type})`);
    
    if (activeChats[uid]) {
        activeChats[uid].messages.push({
            from: 'admin',
            text: `🎫 Вам отправлен код: ${code} (${type})`,
            time: new Date().toLocaleString()
        });
        activeChats[uid].hasNew = true;
    }
    
    render();
    saveToServer();
}

function sendCodeToAllPlayers(code, type) {
    const userKeys = Object.keys(uidMap);
    for (const uid of userKeys) {
        if (bannedUsers[uid]) continue;
        addNotification(uid, `🎫 Всем игрокам: ${code} (${type})`);
        if (activeChats[uid]) {
            activeChats[uid].messages.push({
                from: 'admin',
                text: `🎫 Всем игрокам: ${code} (${type})`,
                time: new Date().toLocaleString()
            });
            activeChats[uid].hasNew = true;
        }
    }
    adminCodes.push({ 
        code: code, 
        type: type + ' (всем)',
        target: 'всем'
    });
    render();
    saveToServer();
}

// ============================================================
//  ОБРАБОТЧИКИ
// ============================================================

function handlePlay() {
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

// ---------- Банк ----------
function handleBank() {
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
            <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong> от первоначальной суммы</p>
            <p style="font-size:12px;color:#888;">💰 Проценты начисляются каждый час</p>
            <button class="btn primary full" onclick="withdrawBank()">💰 Забрать все ⭐</button>
            <button class="btn full small" onclick="closeModal(); render();">🏠 В меню</button>
        `);
    } else {
        openModal('🏦 Банк (20% в час)', `
            <p>Банк пуст.</p>
            <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong> от первоначальной суммы</p>
            <p style="font-size:12px;color:#888;">💰 Проценты начисляются каждый час</p>
            <input type="number" id="bankDepositInput" placeholder="Сумма для вклада" min="1" />
            <button class="btn primary full" onclick="depositBank()">💵 Положить в банк</button>
            <button class="btn full small" onclick="closeModal(); render();">🏠 В меню</button>
        `);
    }
}

window.withdraw
