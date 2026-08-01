// ============================================================
//  UPDATES.JS - МАСШТАБНОЕ ОБНОВЛЕНИЕ "СПАСИТЕЛИ ЗВЁЗД" ⭐
//  Версия 2.0
// ============================================================

console.log('🦸‍♂️ Спасители звёзд v2.0 загружены!');

// ============================================================
//  НОВАЯ КНОПКА В ГЛАВНОМ МЕНЮ
// ============================================================

// Добавляем кнопку в главное меню после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    // Ждём пока появится меню
    const observer = new MutationObserver(function() {
        const btnGrid = document.getElementById('btnGrid');
        if (btnGrid) {
            // Проверяем, не добавлена ли уже кнопка
            if (!document.getElementById('btnHeroes')) {
                // Создаём новую кнопку
                const heroBtn = document.createElement('button');
                heroBtn.id = 'btnHeroes';
                heroBtn.className = 'btn full small';
                heroBtn.style.cssText = `
                    background: linear-gradient(135deg, #ff6b9d, #ff2e63, #ff6b9d);
                    background-size: 200% 200%;
                    animation: bgGradient 3s ease-in-out infinite;
                    border: 2px solid rgba(255, 215, 0, 0.3);
                    box-shadow: 0 0 30px rgba(255, 105, 180, 0.3);
                    font-size: 16px;
                    padding: 14px;
                `;
                heroBtn.innerHTML = '🦸‍♂️ Спасители звёзд';
                heroBtn.onclick = openHeroesMenu;
                
                // Вставляем перед кнопкой "Админ"
                const adminBtn = document.getElementById('btnAdmin');
                if (adminBtn) {
                    adminBtn.parentNode.insertBefore(heroBtn, adminBtn);
                } else {
                    btnGrid.appendChild(heroBtn);
                }
                
                console.log('✅ Кнопка "Спасители звёзд" добавлена!');
            }
            observer.disconnect();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// ============================================================
//  ГЛАВНОЕ МЕНЮ "СПАСИТЕЛИ ЗВЕЗД"
// ============================================================

let heroesProgress = {
    elin: false,    // Пройдена ли миссия Элин
    mark: false,    // Пройдена ли миссия Марка
    comics: false,  // Пройдена ли миссия Комикс
    evna: false     // Пройдена ли миссия Евны
};

// Загружаем прогресс из localStorage
function loadHeroesProgress() {
    try {
        const saved = localStorage.getItem('heroesProgress');
        if (saved) {
            heroesProgress = JSON.parse(saved);
        }
    } catch(e) {}
}

function saveHeroesProgress() {
    try {
        localStorage.setItem('heroesProgress', JSON.stringify(heroesProgress));
    } catch(e) {}
}

loadHeroesProgress();

function openHeroesMenu() {
    const user = getCurrentUser();
    if (!user || !user.registered) {
        showToast('❌ Сначала зарегистрируйтесь!');
        return;
    }
    
    // Сохраняем текущий фон для восстановления
    const originalBg = document.body.style.background;
    
    // Создаём overlay для нового меню
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
    
    // Добавляем анимацию фона
    const style = document.createElement('style');
    style.textContent = `
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
            padding: 25px;
            margin: 10px 0;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            cursor: pointer;
            animation: heroFloat 3s ease-in-out infinite;
        }
        .hero-card:hover {
            transform: scale(1.02);
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
        }
        .hero-card.locked {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(0.5);
        }
        .hero-card .status {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
        }
        .hero-card .status.done {
            color: #ffd93d;
        }
        .hero-card .status.locked {
            color: #ff4757;
        }
        .hero-card .status.available {
            color: #7ed6df;
        }
    `;
    document.head.appendChild(style);
    
    // Создаём контент
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
    
    heroes.forEach(hero => {
        const isUnlocked = hero.id === 'elin' || heroesProgress[hero.id] || 
                          (hero.id !== 'elin' && heroesProgress['elin']);
        const isDone = heroesProgress[hero.id];
        
        let statusText = '🔒 Заблокирован';
        let statusClass = 'locked';
        if (isDone) {
            statusText = '✅ Пройдено!';
            statusClass = 'done';
        } else if (isUnlocked) {
            statusText = '▶️ Доступно';
            statusClass = 'available';
        }
        
        const card = document.createElement('div');
        card.className = 'hero-card' + (isUnlocked && !isDone ? '' : ' locked');
        card.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px;
            margin: 12px 0;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: ${isUnlocked && !isDone ? 'pointer' : 'default'};
            opacity: ${isUnlocked && !isDone ? 1 : 0.5};
        `;
        
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:15px;">
                <span style="font-size:40px;">${hero.emoji}</span>
                <div>
                    <div style="font-size:20px;font-weight:700;color:#fff;">${hero.name}</div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.6);">${hero.desc}</div>
                    <div class="status ${statusClass}">${statusText}</div>
                </div>
            </div>
            <span style="font-size:24px;color:rgba(255,255,255,0.3);">${isDone ? '✅' : (isUnlocked ? '▶️' : '🔒')}</span>
        `;
        
        if (isUnlocked && !isDone) {
            card.onclick = () => {
                if (hero.id === 'elin') {
                    startElinGame();
                } else {
                    showToast('🔄 В разработке!');
                }
            };
        } else if (isDone) {
            card.onclick = () => {
                showToast('✅ Уже пройдено!');
            };
        } else {
            card.onclick = () => {
                showToast('🔒 Сначала пройдите предыдущего героя!');
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
    backBtn.onmouseover = () => {
        backBtn.style.background = 'rgba(255, 255, 255, 0.25)';
    };
    backBtn.onmouseout = () => {
        backBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    };
    backBtn.onclick = () => {
        overlay.remove();
        style.remove();
        document.body.style.background = originalBg || '';
        showToast('⬅️ Возврат в главное меню');
    };
    container.appendChild(backBtn);
    
    overlay.appendChild(container);
    document.body.appendChild(overlay);
}

// ============================================================
//  ИГРА "ЭЛИН" - СОБЕРИ ЗВЁЗДЫ
// ============================================================

let elinGameInterval = null;
let elinStars = [];
let elinCollected = 0;
let elinTimeLeft = 180; // 3 минуты в секундах
let elinTotalStars = 200;
let elinGameActive = false;
let elinGameContainer = null;

function startElinGame() {
    // Закрываем меню героев
    const overlay = document.getElementById('heroesOverlay');
    if (overlay) overlay.remove();
    
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
    
    // Добавляем звёздный фон
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
    startBtn.onmouseover = () => {
        startBtn.style.transform = 'translate(-50%, -50%) scale(1.05)';
    };
    startBtn.onmouseout = () => {
        startBtn.style.transform = 'translate(-50%, -50%) scale(1)';
    };
    startBtn.onclick = startElinGameplay;
    
    // Добавляем стиль для пульсации кнопки
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
        @keyframes pulseBtn {
            0%, 100% { box-shadow: 0 0 60px rgba(255, 105, 180, 0.3); }
            50% { box-shadow: 0 0 80px rgba(255, 105, 180, 0.6); }
        }
        .elin-falling-star {
            position: absolute;
            cursor: pointer;
            font-size: 30px;
            animation: elinFall linear forwards;
            z-index: 1;
            transition: transform 0.1s;
            user-select: none;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }
        .elin-falling-star:hover {
            transform: scale(1.3) !important;
        }
        .elin-falling-star.caught {
            animation: elinCatch 0.3s ease forwards;
        }
        @keyframes elinFall {
            0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(calc(100% + 50px)) rotate(720deg); opacity: 0; }
        }
        @keyframes elinCatch {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2); opacity: 0; }
        }
    `;
    document.head.appendChild(pulseStyle);
    
    starsContainer.appendChild(startBtn);
    gameOverlay.appendChild(starsContainer);
    
    // Кнопка назад из верхней панели
    document.getElementById('elinBackBtn').onclick = () => {
        if (elinGameActive) {
            if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян!')) {
                stopElinGame();
                gameOverlay.remove();
                pulseStyle.remove();
                openHeroesMenu();
            }
        } else {
            gameOverlay.remove();
            pulseStyle.remove();
            openHeroesMenu();
        }
    };
    
    document.body.appendChild(gameOverlay);
    elinGameContainer = gameOverlay;
}

function startElinGameplay() {
    const startBtn = document.getElementById('elinStartBtn');
    if (startBtn) startBtn.remove();
    
    elinCollected = 0;
    elinTimeLeft = 180;
    elinGameActive = true;
    
    document.getElementById('elinCollected').textContent = '0';
    updateElinTimer();
    
    // Запускаем таймер
    elinGameInterval = setInterval(() => {
        elinTimeLeft--;
        updateElinTimer();
        
        // Создаём новые звёзды
        if (elinGameActive && elinStars.length < 30) {
            createElinStar();
        }
        
        if (elinTimeLeft <= 0) {
            endElinGame(false);
        }
    }, 1000);
    
    // Создаём начальные звёзды
    for (let i = 0; i < 15; i++) {
        setTimeout(() => createElinStar(), i * 200);
    }
    
    showToast('🌟 Собирайте звёзды! Нужно 150 за 3 минуты!');
}

function createElinStar() {
    if (!elinGameActive) return;
    
    const container = document.getElementById('elinStarsContainer');
    if (!container) return;
    
    const star = document.createElement('div');
    star.className = 'elin-falling-star';
    const emojis = ['⭐', '🌟', '✨', '💫'];
    star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    star.style.left = Math.random() * 90 + '%';
    star.style.top = '-30px';
    star.style.fontSize = (Math.random() * 20 + 20) + 'px';
    star.style.animationDuration = (Math.random() * 3 + 2) + 's';
    star.dataset.caught = 'false';
    
    star.onclick = function(e) {
        e.stopPropagation();
        if (this.dataset.caught === 'true') return;
        if (!elinGameActive) return;
        
        this.dataset.caught = 'true';
        this.classList.add('caught');
        elinCollected++;
        document.getElementById('elinCollected').textContent = elinCollected;
        
        // Эффект при сборе
        this.style.color = '#ffd93d';
        this.style.textShadow = '0 0 40px rgba(255, 215, 0, 0.8)';
        
        setTimeout(() => {
            if (this.parentNode) this.remove();
        }, 300);
        
        // Проверка победы
        if (elinCollected >= 150) {
            endElinGame(true);
        }
    };
    
    container.appendChild(star);
    elinStars.push(star);
    
    // Удаляем звезду если она упала
    setTimeout(() => {
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
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (elinTimeLeft < 30) {
        timerEl.style.color = '#ff4757';
        timerEl.style.animation = 'pulseBtn 0.5s ease-in-out infinite';
    } else {
        timerEl.style.color = '#ffffff';
        timerEl.style.animation = 'none';
    }
}

function endElinGame(won) {
    if (!elinGameActive) return;
    elinGameActive = false;
    
    if (elinGameInterval) {
        clearInterval(elinGameInterval);
        elinGameInterval = null;
    }
    
    // Удаляем все звёзды
    document.querySelectorAll('.elin-falling-star').forEach(star => star.remove());
    elinStars = [];
    
    const container = document.getElementById('elinStarsContainer');
    if (!container) return;
    
    // Показываем результат
    const resultDiv = document.createElement('div');
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
        // Победа!
        heroesProgress.elin = true;
        saveHeroesProgress();
        
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
        
        // Награда
        const user = getCurrentUser();
        if (user) {
            user.stars = (user.stars || 0) + 50;
            saveAllData();
            saveToServer();
        }
        
        document.getElementById('elinResultBtn').onclick = () => {
            const overlay = document.getElementById('elinGameOverlay');
            if (overlay) overlay.remove();
            openHeroesMenu();
            showToast('🎉 Вы прошли миссию Элин! +50 звёзд!');
        };
        
        showToast('🎉 ПОБЕДА! Вы собрали все звёзды!');
        
    } else {
        // Поражение
        resultDiv.innerHTML = `
            <div style="font-size:60px;margin-bottom:15px;">😢</div>
            <div style="font-size:28px;font-weight:700;color:#ff4757;">ВРЕМЯ ВЫШЛО!</div>
            <div style="font-size:18px;color:rgba(255,255,255,0.8);margin:10px 0;">
                Вы собрали ${elinCollected} ⭐ из 150
            </div>
            <div style="font-size:16px;color:#ff6b9d;margin:10px 0;">
                Попробуйте ещё раз!
            </div>
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
                margin-top: 10px;
                padding: 10px 30px;
                border: none;
                border-radius: 20px;
                background: rgba(255,255,255,0.1);
                color: #fff;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-left: 10px;
            ">🏠 Выйти</button>
        `;
        
        document.getElementById('elinResultBtn').onclick = () => {
            const overlay = document.getElementById('elinGameOverlay');
            if (overlay) overlay.remove();
            startElinGame();
        };
        
        document.getElementById('elinExitBtn').onclick = () => {
            const overlay = document.getElementById('elinGameOverlay');
            if (overlay) overlay.remove();
            openHeroesMenu();
        };
        
        showToast('⏰ Время вышло! Попробуйте ещё раз!');
    }
    
    container.appendChild(resultDiv);
}

function stopElinGame() {
    elinGameActive = false;
    if (elinGameInterval) {
        clearInterval(elinGameInterval);
        elinGameInterval = null;
    }
    elinStars = [];
}

// ============================================================
//  ДОПОЛНИТЕЛЬНЫЕ СТИЛИ ДЛЯ НОВОГО МЕНЮ
// ============================================================

console.log('🦸‍♂️ Спасители звёзд готовы к работе!');
console.log('📝 Доступные герои: Элин, Марк, Комикс, Евна');
console.log('⭐ Миссия Элин: собери 150 звёзд за 3 минуты!');
