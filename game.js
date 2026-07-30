console.log('🚀 Игра загружается...');

// ---------- ПРИВЯЗКА ----------
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
        userId = 'user_' + Date.now();
        localStorage.setItem('telegram_user_id', userId);
    }
    return userId;
}

// ---------- ХРАНИЛИЩЕ ----------
let users = {};
let uidMap = {};
let bannedUsers = {};
let adminCodes = [];
let reports = [];
let activeChats = {};
let contestActive = false;
let contestEndTime = null;
let contestWinner = null;

const PASSIVE_INCOME = { 1: 0, 2: 20, 3: 50, "giant": 300 };
const SERVER_URL = window.location.origin;

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
            wins: [],
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
        console.log('✅ Сохранено:', result);
        return result.success;
    } catch(e) {
        console.error('❌ Ошибка сохранения:', e);
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

// ---------- ОТРИСОВКА ----------
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
    if (user.registered) {
        statusEl.textContent = '✅ Зарегистрирован';
        statusEl.style.color = '#4caf50';
    } else {
        statusEl.textContent = '❌ Не зарегистрирован';
        statusEl.style.color = '#ff4757';
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

    const wheelAttempts = document.getElementById('wheelAttemptsCount');
    if (wheelAttempts) wheelAttempts.textContent = user.attempts || 0;
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

// ---------- КОЛЕСО УДАЧИ ----------
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
        showToast('❌ Попыток нет!');
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
    resultDiv.innerHTML = `🎉 +${finalValue} ⭐ (${result.label})`;
    showToast(`🎉 +${finalValue} ⭐`);
    render();
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

// ---------- ОБРАБОТЧИКИ ----------
function handlePlay() {
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
}

function handleBank() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    updateBankInterest(user);
    const bank = user.bank || 0;
    openModal('🏦 Банк', `
        <p>💰 В банке: <strong>${bank}</strong> ⭐</p>
        <p>📈 Ставка: <strong style="color:#ffd700;">20% в час</strong></p>
        <button class="btn primary full" onclick="withdrawBank()">💰 Забрать все</button>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

window.withdrawBank = function() {
    const user = getCurrentUser();
    const amount = user.bank || 0;
    if (amount <= 0) { showToast('❌ Банк пуст'); return; }
    user.stars += amount;
    user.bank = 0;
    user.bankDeposit = 0;
    closeModal();
    showToast(`✅ Забрано ${amount} ⭐`);
    render();
    saveToServer();
};

function handleClicker() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    user.clickerProgress = (user.clickerProgress || 0) + 1;
    if (user.clickerProgress >= 400) {
        user.stars += 20;
        user.clickerProgress = 0;
        showToast('🎉 +20 ⭐ за клики!');
    } else {
        showToast('⭐ Клик ' + user.clickerProgress + '/400');
    }
    render();
    saveToServer();
}

function handleBuy() {
    const user = getCurrentUser();
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
    render();
    saveToServer();
    showToast('✅ +1 попытка!');
}

function handleLeaderboard() {
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
        </div>
        <button class="btn full small" onclick="closeModal();">🏠 В меню</button>
    `);
}

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
    showToast('🔧 Админ-панель открыта');
};

function handleSupport() {
    showToast('🆘 Поддержка: напишите @admin');
}

function handleCode() {
    showToast('🎫 Введите код');
}

function handleCoeff() {
    showToast('🔥 Коэффициент: +0');
}

function handlePet() {
    const user = getCurrentUser();
    if (!user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    const stage = user.petStage || 1;
    const progress = user.petProgress || 0;
    const threshold = thresholdForStage(stage);
    showToast(`🪳 Прогресс: ${progress}/${threshold}`);
}

// ---------- РЕГИСТРАЦИЯ ----------
let regData = { name: '', gender: '', age: '' };
let genderSelected = false;

function showRegistration() {
    openModal('📝 Регистрация', `
        <p>Добро пожаловать!</p>
        <input type="text" id="regName" placeholder="Имя" style="width:100%;padding:10px;margin:5px 0;border-radius:8px;border:1px solid #444;background:#222;color:#fff;" />
        <div style="display:flex;gap:8px;margin:5px 0;">
            <button class="btn" onclick="selectGender('Мужской')">👨 Мужской</button>
            <button class="btn" onclick="selectGender('Женский')">👩 Женский</button>
        </div>
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

    if (!regData.name) {
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

function checkRegistration() {
    const user = getCurrentUser();
    if (!user.registered) {
        showRegistration();
    }
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM загружен!');
    
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
    
    document.getElementById('wheelSpinBtn').addEventListener('click', spinWheel);
    document.getElementById('wheelCloseBtn').addEventListener('click', closeWheel);
    document.getElementById('wheelCanvas').addEventListener('click', spinWheel);
    
    render();
    initWheel();
    
    setTimeout(async function() {
        await loadFromServer();
        setTimeout(checkRegistration, 500);
    }, 500);
});

// Автосохранение
setInterval(() => {
    const user = getCurrentUser();
    if (user.registered) {
        saveToServer();
    }
}, 15000);
