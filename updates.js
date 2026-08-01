// ============================================================
//  UPDATES.JS - СПАСИТЕЛИ ЗВЁЗД (ИСПРАВЛЕННАЯ ВЕРСИЯ 2.2)
// ============================================================

console.log('🦸‍♂️ Спасители звёзд v2.2 загружаются...');

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
        if (saved) {
            heroesProgress = JSON.parse(saved);
            console.log('📂 Прогресс загружен:', heroesProgress);
        }
    } catch(e) {}
}

function saveHeroesProgress() {
    try {
        localStorage.setItem('heroesProgress', JSON.stringify(heroesProgress));
        console.log('💾 Прогресс сохранён:', heroesProgress);
    } catch(e) {}
}

loadHeroesProgress();

// ============================================================
//  ГЛАВНАЯ ФУНКЦИЯ - ДОЛЖНА БЫТЬ ГЛОБАЛЬНОЙ!
// ============================================================

window.openHeroesMenu = function() {
    console.log('🦸‍♂️ ОТКРЫВАЕМ МЕНЮ ГЕРОЕВ!');
    
    try {
        // Получаем пользователя
        let user = null;
        if (typeof getCurrentUser === 'function') {
            user = getCurrentUser();
        }
        
        if (!user || !user.registered) {
            if (typeof showToast === 'function') {
                showToast('❌ Сначала зарегистрируйтесь!');
            } else {
                alert('❌ Сначала зарегистрируйтесь!');
            }
            return;
        }
        
        // Удаляем старое меню если есть
        const oldOverlay = document.getElementById('heroesOverlay');
        if (oldOverlay) oldOverlay.remove();
        
        // Создаём overlay
        const overlay = document.createElement('div');
        overlay.id = 'heroesOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9998;
            background: linear-gradient(135deg, #ff0844, #ffb199, #ff0844);
            background-size: 300% 300%;
            animation: heroBgGradient 4s ease-in-out infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
        `;
        
        // Добавляем стили для анимации
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
                @keyframes heroFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                .hero-card {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    border-radius: 30px;
                    padding: 20px 25px;
                    margin: 10px 0;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    transition: all 0.3s ease;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .hero-card:hover {
                    transform: scale(1.02);
                    background: rgba(255, 255, 255, 0.2);
                    box-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
                }
                .hero-card.locked {
                    opacity: 0.5;
                    cursor: not-allowed;
                    filter: grayscale(0.5);
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
                    0%, 100% { box-shadow: 0 0 60px rgba(255, 105, 180, 0.3); }
                    50% { box-shadow: 0 0 80px rgba(255, 105, 180, 0.6); }
                }
            `;
            document.head.appendChild(styleEl);
        }
        
        // Контейнер
        const container = document.createElement('div');
        container.style.cssText = `
            max-width: 500px;
            width: 100%;
            padding: 20px;
            position: relative;
            z-index: 1;
        `;
        
        // Заголовок
        const title = document.createElement('h2');
        title.textContent = '🦸‍♂️ Наши герои';
        title.style.cssText = `
            text-align: center;
            color: #ffffff;
            font-size: 32px;
            text-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
            margin-bottom: 25px;
        `;
        container.appendChild(title);
        
        // Герои
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
            if (isDone) {
                statusText = '✅ Пройдено!';
                statusClass = 'status-done';
            } else if (isUnlocked) {
                statusText = '▶️ Доступно';
                statusClass = 'status-available';
            }
            
            const card = document.createElement('div');
            card.className = 'hero-card' + (isUnlocked && !isDone ? '' : ' locked');
            card.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 25px;
                margin: 10px 0;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                border-radius: 30px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s ease;
                cursor: ${isUnlocked && !isDone ? 'pointer' : 'default'};
                opacity: ${isUnlocked && !isDone ? 1 : 0.5};
            `;
            
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
                card.onclick = function(e) {
                    e.stopPropagation();
                    console.log('🔄 Нажали на героя:', hero.id);
                    if (hero.id === 'elin') {
                        console.log('🔄 Запускаем игру Элин...');
                        const overlayEl = document.getElementById('heroesOverlay');
                        if (overlayEl) overlayEl.remove();
                        window.startElinGame();
                    } else {
                        if (typeof showToast === 'function') {
                            showToast('🔄 В разработке!');
                        } else {
                            alert('🔄 В разработке!');
                        }
                    }
                };
            } else if (isDone) {
                card.onclick = function() {
                    if (typeof showToast === 'function') {
                        showToast('✅ Уже пройдено!');
                    }
                };
            } else {
                card.onclick = function() {
                    if (typeof showToast === 'function') {
                        showToast('🔒 Сначала пройдите предыдущего героя!');
                    }
                };
            }
            
            container.appendChild(card);
        });
        
        // Кнопка назад
        const backBtn = document.createElement('button');
        backBtn.textContent = '⬅️ Назад';
        backBtn.style.cssText = `
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            margin-top: 20px;
        `;
        backBtn.onmouseover = function() {
            this.style.background = 'rgba(255, 255, 255, 0.25)';
        };
        backBtn.onmouseout = function() {
            this.style.background = 'rgba(255, 255, 255, 0.15)';
        };
        backBtn.onclick = function() {
            const overlayEl = document.getElementById('heroesOverlay');
            if (overlayEl) overlayEl.remove();
            if (typeof showToast === 'function') {
                showToast('⬅️ Возврат в главное меню');
            }
        };
        container.appendChild(backBtn);
        
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        console.log('✅ Меню героев открыто!');
        
    } catch(e) {
        console.error('❌ Ошибка открытия меню героев:', e);
        if (typeof showToast === 'function') {
            showToast('❌ Ошибка открытия меню');
        }
    }
};

// ============================================================
//  ИГРА "ЭЛИН" - ГЛОБАЛЬНАЯ ФУНКЦИЯ
// ============================================================

let elinGameInterval = null;
let elinStars = [];
let elinCollected = 0;
let elinTimeLeft = 180;
let elinGameActive = false;
let elinGameContainer = null;
let elinStarCreationInterval = null;

window.startElinGame = function() {
    console.log('🌟 ЗАПУСКАЕМ ИГРУ ЭЛИН!');
    
    try {
        // Удаляем старую игру если есть
        const oldGame = document.getElementById('elinGameOverlay');
        if (oldGame) oldGame.remove();
        
        // Создаём игровое поле
        const gameOverlay = document.createElement('div');
        gameOverlay.id = 'elinGameOverlay';
        gameOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            background: linear-gradient(135deg, #0a0515, #1a0e3e, #0a0515);
            background-size: 300% 300%;
            animation: heroBgGradient 6s ease-in-out infinite;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            overflow: hidden;
        `;
        
        // Звёздный фон
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.textContent = '✦';
            star.style.cssText = `
                position: absolute;
                color: rgba(255, 255, 255, 0.1);
                font-size: ${Math.random() * 20 + 10}px;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                animation: sparkleFall ${Math.random() * 20 + 10}s linear infinite;
                animation-delay: ${Math.random() * 10}s;
                pointer-events: none;
            `;
            gameOverlay.appendChild(star);
        }
        
        // Верхняя панель
        const topPanel = document.createElement('div');
        topPanel.style.cssText = `
            width: 100%;
            max-width: 500px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 2;
            margin-bottom: 15px;
        `;
        topPanel.innerHTML = `
            <div style="color:#fff;font-weight:700;">
                ⏱️ <span id="elinTimer">03:00</span>
            </div>
            <div style="color:#ffd93d;font-weight:700;font-size:20px;">
                ⭐ <span id="elinCollected">0</span> / 150
            </div>
            <button id="elinBackBtn" style="
                padding: 8px 16px;
                border: none;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">✖</button>
        `;
        gameOverlay.appendChild(topPanel);
        
        // Контейнер для звёзд
        const starsContainer = document.createElement('div');
        starsContainer.id = 'elinStarsContainer';
        starsContainer.style.cssText = `
            width: 100%;
            max-width: 500px;
            flex: 1;
            position: relative;
            border-radius: 30px;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.05);
        `;
        
        // Кнопка "Начать"
        const startBtn = document.createElement('button');
        startBtn.id = 'elinStartBtn';
        startBtn.textContent = '🌟 НАЧАТЬ';
        startBtn.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 50px;
            border: none;
            border-radius: 30px;
            background: linear-gradient(135deg, #ff6b9d, #ff2e63);
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            cursor: pointer;
            z-index: 10;
            box-shadow: 0 0 60px rgba(255, 105, 180, 0.3);
            transition: all 0.3s ease;
            animation: pulseBtn 2s ease-in-out infinite;
        `;
        startBtn.onmouseover = function() {
            this.style.transform = 'translate(-50%, -50%) scale(1.05)';
        };
        startBtn.onmouseout = function() {
            this.style.transform = 'translate(-50%, -50%) scale(1)';
        };
        startBtn.onclick = function() {
            console.log('🔄 Начинаем игру!');
            window.startElinGameplay();
        };
        
        starsContainer.appendChild(startBtn);
        gameOverlay.appendChild(starsContainer);
        
        // Кнопка "Назад" из верхней панели
        document.getElementById('elinBackBtn').onclick = function() {
            if (elinGameActive) {
                if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян!')) {
                    window.stopElinGame();
                    const overlayEl = document.getElementById('elinGameOverlay');
                    if (overlayEl) overlayEl.remove();
                    window.openHeroesMenu();
                }
            } else {
                const overlayEl = document.getElementById('elinGameOverlay');
                if (overlayEl) overlayEl.remove();
                window.openHeroesMenu();
            }
        };
        
        document.body.appendChild(gameOverlay);
        elinGameContainer = gameOverlay;
        console.log('✅ Игра Элин создана, ждём нажатия "Начать"');
        
    } catch(e) {
        console.error('❌ Ошибка создания игры:', e);
        if (typeof showToast === 'function') {
            showToast('❌ Ошибка создания игры');
        }
    }
};

window.startElinGameplay = function() {
    console.log('🎮 Игровой процесс начат!');
    
    const startBtn = document.getElementById('elinStartBtn');
    if (startBtn) startBtn.remove();
    
    elinCollected = 0;
    elinTimeLeft = 180;
    elinGameActive = true;
    elinStars = [];
    
    const collectedEl = document.getElementById('elinCollected');
    if (collectedEl) collectedEl.textContent = '0';
    window.updateElinTimer();
    
    // Таймер игры
    if (elinGameInterval) clearInterval(elinGameInterval);
    elinGameInterval = setInterval(function() {
        elinTimeLeft--;
        window.updateElinTimer();
        
        if (elinTimeLeft <= 0) {
            window.endElinGame(false);
        }
    }, 1000);
    
    // Создание звёзд
    if (elinStarCreationInterval) clearInterval(elinStarCreationInterval);
    elinStarCreationInterval = setInterval(function() {
        if (elinGameActive) {
            window.createElinStar();
        }
    }, 400);
    
    // Создаём начальные звёзды
    for (let i = 0; i < 20; i++) {
        setTimeout(function() { window.createElinStar(); }, i * 150);
    }
    
    if (typeof showToast === 'function') {
        showToast('🌟 Собирайте звёзды! Нужно 150 за 3 минуты!');
    }
};

window.createElinStar = function() {
    if (!elinGameActive) return;
    
    const container = document.getElementById('elinStarsContainer');
    if (!container) return;
    
    // Ограничиваем количество звёзд на экране
    const existingStars = container.querySelectorAll('.elin-falling-star');
    if (existingStars.length > 40) return;
    
    const star = document.createElement('div');
    star.className = 'elin-falling-star';
    const emojis = ['⭐', '🌟', '✨', '💫'];
    star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    star.style.cssText = `
        position: absolute;
        left: ${Math.random() * 90 + 5}%;
        top: -30px;
        font-size: ${Math.random() * 20 + 20}px;
        cursor: pointer;
        z-index: 1;
        user-select: none;
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        animation: elinFall ${Math.random() * 3 + 2}s linear forwards;
        transition: transform 0.1s;
    `;
    star.dataset.caught = 'false';
    
    star.onclick = function(e) {
        e.stopPropagation();
        if (this.dataset.caught === 'true') return;
        if (!elinGameActive) return;
        
        this.dataset.caught = 'true';
        this.style.animation = 'elinCatch 0.3s ease forwards';
        elinCollected++;
        const collectedEl = document.getElementById('elinCollected');
        if (collectedEl) collectedEl.textContent = elinCollected;
        
        this.style.color = '#ffd93d';
        this.style.textShadow = '0 0 40px rgba(255, 215, 0, 0.8)';
        
        setTimeout(function() {
            if (this && this.parentNode) this.remove();
        }, 300);
        
        // Проверка победы
        if (elinCollected >= 150) {
            window.endElinGame(true);
        }
    };
    
    container.appendChild(star);
    elinStars.push(star);
    
    // Удаляем звезду если она упала
    setTimeout(function() {
        if (star.parentNode && star.dataset.caught === 'false') {
            star.remove();
            const index = elinStars.indexOf(star);
            if (index > -1) elinStars.splice(index, 1);
        }
    }, 5000);
};

window.updateElinTimer = function() {
    const timerEl = document.getElementById('elinTimer');
    if (!timerEl) return;
    
    const minutes = Math.floor(elinTimeLeft / 60);
    const seconds = elinTimeLeft % 60;
    timerEl.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    
    if (elinTimeLeft < 30) {
        timerEl.style.color = '#ff4757';
    } else {
        timerEl.style.color = '#ffffff';
    }
};

window.endElinGame = function(won) {
    console.log('🏁 Игра закончена. Победа:', won);
    
    if (!elinGameActive) return;
    elinGameActive = false;
    
    if (elinGameInterval) {
        clearInterval(elinGameInterval);
        elinGameInterval = null;
    }
    if (elinStarCreationInterval) {
        clearInterval(elinStarCreationInterval);
        elinStarCreationInterval = null;
    }
    
    // Удаляем все звёзды
    document.querySelectorAll('.elin-falling-star').forEach(function(star) {
        star.remove();
    });
    elinStars = [];
    
    const container = document.getElementById('elinStarsContainer');
    if (!container) return;
    
    // Удаляем старые результаты
    const oldResult = container.querySelector('.elin-result');
    if (oldResult) oldResult.remove();
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'elin-result';
    resultDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        z-index: 10;
        background: rgba(0, 0, 0, 0.7);
        padding: 40px;
        border-radius: 30px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 280px;
    `;
    
    if (won) {
        heroesProgress.elin = true;
        saveHeroesProgress();
        
        // Награда
        try {
            if (typeof getCurrentUser === 'function') {
                const user = getCurrentUser();
                if (user) {
                    user.stars = (user.stars || 0) + 50;
                    if (typeof saveAllData === 'function') saveAllData();
                    if (typeof saveToServer === 'function') saveToServer();
                    console.log('🎁 Награда: +50 звёзд игроку', user.name);
                }
            }
        } catch(e) {
            console.error('Ошибка начисления награды:', e);
        }
        
        resultDiv.innerHTML = `
            <div style="font-size:60px;margin-bottom:15px;">🎉</div>
            <div style="font-size:28px;font-weight:700;color:#ffd93d;">ПОБЕДА!</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin:10px 0;">
                Вы собрали ${elinCollected} ⭐ за 3 минуты!
            </div>
            <div style="font-size:16px;color:#7ed6df;margin:10px 0;">
                🎁 Награда: +50 звёзд на аккаунт!
            </div>
            <button id="elinResultBtn" style="
                margin-top: 15px;
                padding: 12px 40px;
                border: none;
                border-radius: 20px;
                background: linear-gradient(135deg, #ffd93d, #f0932b);
                color: #1a1a2e;
                font-size: 18px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
            ">✅ Отлично!</button>
        `;
        
        document.getElementById('elinResultBtn').onclick = function() {
            const overlayEl = document.getElementById('elinGameOverlay');
            if (overlayEl) overlayEl.remove();
            window.openHeroesMenu();
            if (typeof showToast === 'function') {
                showToast('🎉 Вы прошли миссию Элин! +50 звёзд!');
            }
        };
        
        if (typeof showToast === 'function') {
            showToast('🎉 ПОБЕДА! Вы собрали все звёзды!');
        }
        
    } else {
        resultDiv.innerHTML = `
            <div style="font-size:60px;margin-bottom:15px;">😢</div>
            <div style="font-size:28px;font-weight:700;color:#ff4757;">ВРЕМЯ ВЫШЛО!</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin:10px 0;">
                Вы собрали ${elinCollected} ⭐ из 150
            </div>
            <div style="font-size:16px;color:#ff6b9d;margin:10px 0;">
                Попробуйте ещё раз!
            </div>
            <div>
                <button id="elinResultBtn" style="
                    margin-top: 15px;
                    padding: 12px 40px;
                    border: none;
                    border-radius: 20px;
                    background: linear-gradient(135deg, #ff6b9d, #ff2e63);
                    color: #fff;
                    font-size: 18px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">🔄 Попробовать снова</button>
                <button id="elinExitBtn" style="
                    margin-top: 15px;
                    padding: 12px 30px;
                    border: none;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-left: 10px;
                ">🏠 Выйти</button>
            </div>
        `;
        
        document.getElementById('elinResultBtn').onclick = function() {
            const overlayEl = document.getElementById('elinGameOverlay');
            if (overlayEl) overlayEl.remove();
            window.startElinGame();
        };
        
        document.getElementById('elinExitBtn').onclick = function() {
            const overlayEl = document.getElementById('elinGameOverlay');
            if (overlayEl) overlayEl.remove();
            window.openHeroesMenu();
        };
        
        if (typeof showToast === 'function') {
            showToast('⏰ Время вышло! Попробуйте ещё раз!');
        }
    }
    
    container.appendChild(resultDiv);
};

window.stopElinGame = function() {
    console.log('🛑 Остановка игры...');
    elinGameActive = false;
    if (elinGameInterval) {
        clearInterval(elinGameInterval);
        elinGameInterval = null;
    }
    if (elinStarCreationInterval) {
        clearInterval(elinStarCreationInterval);
        elinStarCreationInterval = null;
    }
    elinStars = [];
};

// ============================================================
//  ДОБАВЛЕНИЕ КНОПКИ В ГЛАВНОЕ МЕНЮ
// ============================================================

function addHeroButtonToMenu() {
    const btnGrid = document.getElementById('btnGrid');
    if (!btnGrid) {
        console.log('⏳ btnGrid не найден, повторная попытка...');
        setTimeout(addHeroButtonToMenu, 500);
        return;
    }
    
    if (document.getElementById('btnHeroes')) {
        console.log('✅ Кнопка уже существует');
        return;
    }
    
    console.log('🦸‍♂️ Добавляем кнопку "Спасители звёзд"...');
    
    const heroBtn = document.createElement('button');
    heroBtn.id = 'btnHeroes';
    heroBtn.className = 'btn full small';
    heroBtn.textContent = '🦸‍♂️ Спасители звёзд';
    heroBtn.style.cssText = `
        background: linear-gradient(135deg, #ff6b9d, #ff2e63, #ff6b9d) !important;
        background-size: 200% 200% !important;
        animation: bgGradient 3s ease-in-out infinite !important;
        border: 2px solid rgba(255, 215, 0, 0.3) !important;
        box-shadow: 0 0 30px rgba(255, 105, 180, 0.3) !important;
        font-size: 16px !important;
        padding: 14px !important;
        grid-column: span 3 !important;
        color: white !important;
        border-radius: 20px !important;
        cursor: pointer !important;
        font-weight: 700 !important;
        transition: all 0.3s ease !important;
    `;
    heroBtn.onmouseover = function() {
        this.style.transform = 'scale(1.02)';
    };
    heroBtn.onmouseout = function() {
        this.style.transform = 'scale(1)';
    };
    heroBtn.onclick = function() {
        console.log('🦸‍♂️ Нажата кнопка "Спасители звёзд"');
        if (typeof window.openHeroesMenu === 'function') {
            window.openHeroesMenu();
        } else {
            console.error('❌ Функция openHeroesMenu не найдена!');
            if (typeof showToast === 'function') {
                showToast('⚠️ Меню героев временно недоступно');
            } else {
                alert('⚠️ Меню героев временно недоступно');
            }
        }
    };
    
    const adminBtn = document.getElementById('btnAdmin');
    if (adminBtn) {
        btnGrid.insertBefore(heroBtn, adminBtn);
    } else {
        btnGrid.appendChild(heroBtn);
    }
    
    console.log('✅ Кнопка "Спасители звёзд" добавлена!');
}

// ============================================================
//  АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ КНОПКИ
// ============================================================

// Делаем функцию глобальной для проверки
window.addHeroButtonToMenu = addHeroButtonToMenu;

// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, добавляем кнопку...');
    setTimeout(addHeroButtonToMenu, 1000);
    setTimeout(addHeroButtonToMenu, 3000);
    setTimeout(addHeroButtonToMenu, 5000);
});

// Также пробуем добавить при появлении app
const appObserver = new MutationObserver(function() {
    const app = document.getElementById('app');
    if (app && app.classList.contains('show')) {
        console.log('📱 Приложение появилось, добавляем кнопку...');
        setTimeout(addHeroButtonToMenu, 500);
        setTimeout(addHeroButtonToMenu, 1500);
        appObserver.disconnect();
    }
});
appObserver.observe(document.body, { childList: true, subtree: true });

console.log('🦸‍♂️ Спасители звёзд готовы к работе!');
console.log('📝 Версия: 2.2');
console.log('🔍 Проверка: window.openHeroesMenu =', typeof window.openHeroesMenu);
