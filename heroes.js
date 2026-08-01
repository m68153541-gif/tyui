// ============================================================
//  HEROES.JS - ЛОГИКА ГЕРОЕВ "СПАСИТЕЛИ ЗВЁЗД"
//  Этот файл работает вместе с game.js, не конфликтуя с ним
// ============================================================

console.log('🦸‍♂️ Heroes.js загружен!');

// ============================================================
//  ПРОГРЕСС ГЕРОЕВ
// ============================================================
let heroesProgress = {
    elin: false,
    mark: false,
    comics: false,
    evna: false
};

function loadHeroesProgress() {
    try {
        const saved = localStorage.getItem('heroesProgress');
        if (saved) heroesProgress = JSON.parse(saved);
    } catch(e) {}
}
function saveHeroesProgress() {
    try {
        localStorage.setItem('heroesProgress', JSON.stringify(heroesProgress));
    } catch(e) {}
}
loadHeroesProgress();

// ============================================================
//  ОТКРЫТИЕ МЕНЮ ГЕРОЕВ
// ============================================================
function openHeroesMenu() {
    // Проверяем регистрацию через game.js
    if (typeof getCurrentUser === 'function') {
        const user = getCurrentUser();
        if (!user || !user.registered) {
            if (typeof showToast === 'function') {
                showToast('❌ Сначала зарегистрируйтесь!');
            }
            if (typeof checkRegistration === 'function') {
                checkRegistration();
            }
            return;
        }
    }

    // Удаляем старые overlay
    const oldOverlay = document.getElementById('heroesOverlay');
    if (oldOverlay) oldOverlay.remove();

    // Создаём overlay
    const overlay = document.createElement('div');
    overlay.id = 'heroesOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998;
        background: linear-gradient(135deg, #ff0844, #ffb199, #ff0844);
        background-size: 300% 300%;
        animation: heroBgGradient 4s ease-in-out infinite;
        display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;
    `;

    // Стили для меню
    let styleEl = document.getElementById('heroesStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'heroesStyle';
        styleEl.textContent = `
            @keyframes heroBgGradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            .hero-card {
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(20px);
                border-radius: 30px;
                padding: 20px 25px;
                margin: 10px 0;
                border: 1px solid rgba(255,255,255,0.2);
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .hero-card:hover {
                background: rgba(255,255,255,0.2);
                transform: scale(1.02);
            }
            .hero-card.locked {
                opacity: 0.5;
                filter: grayscale(0.5);
                cursor: not-allowed;
            }
            .hero-card .status-done { color: #ffd93d; }
            .hero-card .status-locked { color: #ff4757; }
            .hero-card .status-available { color: #7ed6df; }
            @keyframes elinFall {
                0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(calc(100% + 50px)) rotate(720deg); opacity: 0; }
            }
            @keyframes elinCatch {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(2); opacity: 0; }
            }
            @keyframes pulseBtn {
                0%, 100% { box-shadow: 0 0 60px rgba(255,105,180,0.3); }
                50% { box-shadow: 0 0 80px rgba(255,105,180,0.6); }
            }
        `;
        document.head.appendChild(styleEl);
    }

    const container = document.createElement('div');
    container.style.cssText = `max-width: 500px; width: 100%; padding: 20px;`;

    const title = document.createElement('h2');
    title.textContent = '🦸‍♂️ Наши герои';
    title.style.cssText = `text-align: center; color: #fff; font-size: 32px; margin-bottom: 25px;`;
    container.appendChild(title);

    const heroes = [
        { id: 'elin', name: 'Элин', emoji: '👩‍🚀', desc: 'Собери 150 звёзд за 3 минуты' },
        { id: 'mark', name: 'Марк', emoji: '🧑‍🚀', desc: 'В разработке...' },
        { id: 'comics', name: 'Комикс', emoji: '🦸', desc: 'В разработке...' },
        { id: 'evna', name: 'Евна', emoji: '👩‍💻', desc: 'В разработке...' }
    ];

    heroes.forEach(function(hero) {
        const isUnlocked = hero.id === 'elin' || heroesProgress[hero.id] || 
                          (hero.id !== 'elin' && heroesProgress['elin']);
        const isDone = heroesProgress[hero.id];

        let statusText = '🔒 Заблокирован';
        let statusClass = 'status-locked';
        if (isDone) { statusText = '✅ Пройдено!'; statusClass = 'status-done'; }
        else if (isUnlocked) { statusText = '▶️ Доступно'; statusClass = 'status-available'; }

        const card = document.createElement('div');
        card.className = 'hero-card' + (isUnlocked && !isDone ? '' : ' locked');

        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:15px;">
                <span style="font-size:40px;">${hero.emoji}</span>
                <div>
                    <div style="font-size:20px;font-weight:700;color:#fff;">${hero.name}</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.6);">${hero.desc}</div>
                    <div class="${statusClass}" style="font-size:13px;">${statusText}</div>
                </div>
            </div>
            <span style="font-size:24px;color:rgba(255,255,255,0.3);">${isDone ? '✅' : (isUnlocked ? '▶️' : '🔒')}</span>
        `;

        if (isUnlocked && !isDone) {
            card.onclick = function() {
                if (hero.id === 'elin') {
                    const overlayEl = document.getElementById('heroesOverlay');
                    if (overlayEl) overlayEl.remove();
                    startElinGame();
                } else {
                    if (typeof showToast === 'function') showToast('🔄 В разработке!');
                }
            };
        } else if (isDone) {
            card.onclick = function() {
                if (typeof showToast === 'function') showToast('✅ Уже пройдено!');
            };
        } else {
            card.onclick = function() {
                if (typeof showToast === 'function') showToast('🔒 Сначала пройдите предыдущего героя!');
            };
        }
        container.appendChild(card);
    });

    const backBtn = document.createElement('button');
    backBtn.textContent = '⬅️ Назад';
    backBtn.style.cssText = `
        width: 100%; padding: 16px; border: none; border-radius: 20px;
        background: rgba(255,255,255,0.15); color: #fff; font-size: 18px;
        font-weight: 700; cursor: pointer; margin-top: 20px;
    `;
    backBtn.onclick = function() {
        const overlayEl = document.getElementById('heroesOverlay');
        if (overlayEl) overlayEl.remove();
        if (typeof showToast === 'function') showToast('⬅️ Возврат в главное меню');
    };
    container.appendChild(backBtn);

    overlay.appendChild(container);
    document.body.appendChild(overlay);
}

// ============================================================
//  ИГРА ЭЛИН
// ============================================================
let elinGameInterval = null;
let elinStars = [];
let elinCollected = 0;
let elinTimeLeft = 180;
let elinGameActive = false;
let elinStarCreationInterval = null;
let elinGameOverlay = null;

function startElinGame() {
    // Удаляем старую игру
    const oldGame = document.getElementById('elinGameOverlay');
    if (oldGame) oldGame.remove();

    const gameOverlay = document.createElement('div');
    gameOverlay.id = 'elinGameOverlay';
    gameOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;
        background: linear-gradient(135deg, #0a0515, #1a0e3e, #0a0515);
        background-size: 300% 300%;
        animation: heroBgGradient 6s ease-in-out infinite;
        display: flex; flex-direction: column; align-items: center; padding: 20px; overflow: hidden;
    `;

    // Звёздный фон
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.textContent = '✦';
        star.style.cssText = `
            position: absolute; color: rgba(255,255,255,0.1);
            font-size: ${Math.random()*20+10}px; top: ${Math.random()*100}%;
            left: ${Math.random()*100}%; animation: sparkleFall ${Math.random()*20+10}s linear infinite;
            animation-delay: ${Math.random()*10}s; pointer-events: none;
        `;
        gameOverlay.appendChild(star);
    }

    // Верхняя панель
    const topPanel = document.createElement('div');
    topPanel.style.cssText = `
        width: 100%; max-width: 500px; display: flex; justify-content: space-between;
        align-items: center; padding: 15px 20px; background: rgba(255,255,255,0.05);
        border-radius: 20px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
        z-index: 2; margin-bottom: 15px;
    `;
    topPanel.innerHTML = `
        <div style="color:#fff;font-weight:700;">⏱️ <span id="elinTimer">03:00</span></div>
        <div style="color:#ffd93d;font-weight:700;font-size:20px;">⭐ <span id="elinCollected">0</span> / 150</div>
        <button id="elinBackBtn" style="padding:8px 16px;border:none;border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:14px;border:1px solid rgba(255,255,255,0.1);">✖</button>
    `;
    gameOverlay.appendChild(topPanel);

    // Контейнер для звёзд
    const starsContainer = document.createElement('div');
    starsContainer.id = 'elinStarsContainer';
    starsContainer.style.cssText = `
        width: 100%; max-width: 500px; flex: 1; position: relative;
        border-radius: 30px; overflow: hidden; background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.05);
    `;

    // Кнопка "Начать"
    const startBtn = document.createElement('button');
    startBtn.id = 'elinStartBtn';
    startBtn.textContent = '🌟 НАЧАТЬ';
    startBtn.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        padding: 20px 50px; border: none; border-radius: 30px;
        background: linear-gradient(135deg, #ff6b9d, #ff2e63); color: #fff;
        font-size: 24px; font-weight: 700; cursor: pointer; z-index: 10;
        box-shadow: 0 0 60px rgba(255,105,180,0.3); animation: pulseBtn 2s ease-in-out infinite;
    `;
    startBtn.onclick = function() { startElinGameplay(); };
    starsContainer.appendChild(startBtn);
    gameOverlay.appendChild(starsContainer);

    document.getElementById('elinBackBtn').onclick = function() {
        if (elinGameActive) {
            if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян!')) {
                stopElinGame();
                gameOverlay.remove();
                openHeroesMenu();
            }
        } else {
            gameOverlay.remove();
            openHeroesMenu();
        }
    };

    document.body.appendChild(gameOverlay);
    elinGameOverlay = gameOverlay;
}

function startElinGameplay() {
    const startBtn = document.getElementById('elinStartBtn');
    if (startBtn) startBtn.remove();

    elinCollected = 0;
    elinTimeLeft = 180;
    elinGameActive = true;
    elinStars = [];

    document.getElementById('elinCollected').textContent = '0';
    updateElinTimer();

    if (elinGameInterval) clearInterval(elinGameInterval);
    elinGameInterval = setInterval(function() {
        elinTimeLeft--;
        updateElinTimer();
        if (elinTimeLeft <= 0) endElinGame(false);
    }, 1000);

    if (elinStarCreationInterval) clearInterval(elinStarCreationInterval);
    elinStarCreationInterval = setInterval(function() {
        if (elinGameActive) createElinStar();
    }, 400);

    for (let i = 0; i < 20; i++) {
        setTimeout(function() { createElinStar(); }, i * 150);
    }
    if (typeof showToast === 'function') showToast('🌟 Собирайте звёзды! Нужно 150 за 3 минуты!');
}

function createElinStar() {
    if (!elinGameActive) return;
    const container = document.getElementById('elinStarsContainer');
    if (!container) return;

    const existingStars = container.querySelectorAll('.elin-falling-star');
    if (existingStars.length > 40) return;

    const star = document.createElement('div');
    star.className = 'elin-falling-star';
    const emojis = ['⭐', '🌟', '✨', '💫'];
    star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    star.style.cssText = `
        position: absolute; left: ${Math.random()*90+5}%; top: -30px;
        font-size: ${Math.random()*20+20}px; cursor: pointer; z-index: 1;
        user-select: none; text-shadow: 0 0 20px rgba(255,215,0,0.5);
        animation: elinFall ${Math.random()*3+2}s linear forwards;
    `;
    star.dataset.caught = 'false';

    star.onclick = function(e) {
        e.stopPropagation();
        if (this.dataset.caught === 'true') return;
        if (!elinGameActive) return;

        this.dataset.caught = 'true';
        this.style.animation = 'elinCatch 0.3s ease forwards';
        elinCollected++;
        document.getElementById('elinCollected').textContent = elinCollected;
        this.style.color = '#ffd93d';
        this.style.textShadow = '0 0 40px rgba(255,215,0,0.8)';

        setTimeout(function() { if (this && this.parentNode) this.remove(); }, 300);
        if (elinCollected >= 150) endElinGame(true);
    };

    container.appendChild(star);
    elinStars.push(star);

    setTimeout(function() {
        if (star.parentNode && star.dataset.caught === 'false') {
            star.remove();
            const index = elinStars.indexOf(star);
            if (index > -1) elinStars.splice(index, 1);
        }
    }, 5000);
}

function updateElinTimer() {
    const timerEl = document.getElementById('elinTimer');
    if (!timerEl) return;
    const minutes = Math.floor(elinTimeLeft / 60);
    const seconds = elinTimeLeft % 60;
    timerEl.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    timerEl.style.color = elinTimeLeft < 30 ? '#ff4757' : '#ffffff';
}

function endElinGame(won) {
    if (!elinGameActive) return;
    elinGameActive = false;

    if (elinGameInterval) { clearInterval(elinGameInterval); elinGameInterval = null; }
    if (elinStarCreationInterval) { clearInterval(elinStarCreationInterval); elinStarCreationInterval = null; }

    document.querySelectorAll('.elin-falling-star').forEach(function(star) { star.remove(); });
    elinStars = [];

    const container = document.getElementById('elinStarsContainer');
    if (!container) return;

    const resultDiv = document.createElement('div');
    resultDiv.className = 'elin-result';
    resultDiv.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; z-index: 10; background: rgba(0,0,0,0.7); padding: 40px;
        border-radius: 30px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
        min-width: 280px;
    `;

    if (won) {
        heroesProgress.elin = true;
        saveHeroesProgress();

        // Награда через game.js
        try {
            if (typeof getCurrentUser === 'function') {
                const user = getCurrentUser();
                if (user) {
                    user.stars = (user.stars || 0) + 50;
                    if (typeof saveAllData === 'function') saveAllData();
                    if (typeof saveToServer === 'function') saveToServer();
                }
            }
        } catch(e) {}

        resultDiv.innerHTML = `
            <div style="font-size:60px;margin-bottom:15px;">🎉</div>
            <div style="font-size:28px;font-weight:700;color:#ffd93d;">ПОБЕДА!</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin:10px 0;">Вы собрали ${elinCollected} ⭐ за 3 минуты!</div>
            <div style="font-size:16px;color:#7ed6df;margin:10px 0;">🎁 Награда: +50 звёзд на аккаунт!</div>
            <button id="elinResultBtn" style="margin-top:15px;padding:12px 40px;border:none;border-radius:20px;background:linear-gradient(135deg,#ffd93d,#f0932b);color:#1a1a2e;font-size:18px;font-weight:700;cursor:pointer;">✅ Отлично!</button>
        `;
        document.getElementById('elinResultBtn').onclick = function() {
            if (elinGameOverlay) elinGameOverlay.remove();
            openHeroesMenu();
            if (typeof showToast === 'function') showToast('🎉 Вы прошли миссию Элин! +50 звёзд!');
        };
        if (typeof showToast === 'function') showToast('🎉 ПОБЕДА!');
    } else {
        resultDiv.innerHTML = `
            <div style="font-size:60px;margin-bottom:15px;">😢</div>
            <div style="font-size:28px;font-weight:700;color:#ff4757;">ВРЕМЯ ВЫШЛО!</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin:10px 0;">Вы собрали ${elinCollected} ⭐ из 150</div>
            <div style="font-size:16px;color:#ff6b9d;margin:10px 0;">Попробуйте ещё раз!</div>
            <div>
                <button id="elinResultBtn" style="margin-top:15px;padding:12px 40px;border:none;border-radius:20px;background:linear-gradient(135deg,#ff6b9d,#ff2e63);color:#fff;font-size:18px;font-weight:700;cursor:pointer;">🔄 Попробовать снова</button>
                <button id="elinExitBtn" style="margin-top:15px;padding:12px 30px;border:none;border-radius:20px;background:rgba(255,255,255,0.1);color:#fff;font-size:16px;cursor:pointer;margin-left:10px;">🏠 Выйти</button>
            </div>
        `;
        document.getElementById('elinResultBtn').onclick = function() {
            if (elinGameOverlay) elinGameOverlay.remove();
            startElinGame();
        };
        document.getElementById('elinExitBtn').onclick = function() {
            if (elinGameOverlay) elinGameOverlay.remove();
            openHeroesMenu();
        };
        if (typeof showToast === 'function') showToast('⏰ Время вышло! Попробуйте ещё раз!');
    }
    container.appendChild(resultDiv);
}

function stopElinGame() {
    elinGameActive = false;
    if (elinGameInterval) { clearInterval(elinGameInterval); elinGameInterval = null; }
    if (elinStarCreationInterval) { clearInterval(elinStarCreationInterval); elinStarCreationInterval = null; }
    elinStars = [];
}

// ============================================================
//  ДЕЛАЕМ ФУНКЦИИ ГЛОБАЛЬНЫМИ
// ============================================================
window.openHeroesMenu = openHeroesMenu;
window.startElinGame = startElinGame;

console.log('🦸‍♂️ Heroes.js готов!');
console.log('🔍 openHeroesMenu доступна:', typeof openHeroesMenu === 'function');
console.log('🔍 startElinGame доступна:', typeof startElinGame === 'function');
