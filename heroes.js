// ============================================================
//  HEROES.JS - ЛОГИКА ГЕРОЕВ "СПАСИТЕЛИ ЗВЁЗД"
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
//  ДОБАВЛЕНИЕ КНОПКИ "СПАСИТЕЛИ ЗВЁЗД"
// ============================================================
function addHeroButton() {
    const btnGrid = document.getElementById('btnGrid');
    if (!btnGrid) {
        setTimeout(addHeroButton, 500);
        return;
    }

    if (document.getElementById('btnHeroes')) return;

    const heroBtn = document.createElement('button');
    heroBtn.id = 'btnHeroes';
    heroBtn.className = 'btn full small';
    heroBtn.textContent = '🦸‍♂️ Спасители звёзд';
    heroBtn.style.cssText = `
        background: linear-gradient(135deg, #ff6b9d, #ff2e63, #ff6b9d) !important;
        background-size: 200% 200% !important;
        animation: btnHeroesGradient 3s ease-in-out infinite !important;
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
        if (typeof openHeroesMenu === 'function') {
            openHeroesMenu();
        } else {
            showToast('⚠️ Меню героев загружается...');
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
//  ОТКРЫТИЕ МЕНЮ ГЕРОЕВ
// ============================================================
function openHeroesMenu() {
    console.log('🦸‍♂️ Открываем меню героев...');

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

    const oldOverlay = document.getElementById('heroesOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'heroesOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998;
        background: linear-gradient(135deg, #ff0844, #ffb199, #ff0844);
        background-size: 300% 300%;
        animation: heroBgGradient 4s ease-in-out infinite;
        display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;
    `;

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
                    // ОТКРЫВАЕМ МИНИ-ИГРУ
                    window.open('elin_game.html', '_blank', 'width=420,height=650');
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
        transition: all 0.3s ease;
    `;
    backBtn.onmouseover = function() {
        this.style.background = 'rgba(255,255,255,0.25)';
    };
    backBtn.onmouseout = function() {
        this.style.background = 'rgba(255,255,255,0.15)';
    };
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
//  ДЕЛАЕМ ФУНКЦИИ ГЛОБАЛЬНЫМИ
// ============================================================
window.openHeroesMenu = openHeroesMenu;

// ============================================================
//  АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ КНОПКИ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен, добавляем кнопку...');
    setTimeout(addHeroButton, 1000);
    setTimeout(addHeroButton, 3000);
    setTimeout(addHeroButton, 5000);
});

const appObserver = new MutationObserver(function() {
    const app = document.getElementById('app');
    if (app && app.classList.contains('show')) {
        console.log('📱 Приложение появилось, добавляем кнопку...');
        setTimeout(addHeroButton, 500);
        setTimeout(addHeroButton, 1500);
        appObserver.disconnect();
    }
});
appObserver.observe(document.body, { childList: true, subtree: true });

console.log('🦸‍♂️ Heroes.js готов!');
console.log('🔍 openHeroesMenu доступна:', typeof openHeroesMenu === 'function');
