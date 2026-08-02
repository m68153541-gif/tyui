// ============================================================
//  FEATURES.JS - МАГАЗИН СКИНОВ 🛍️
//  Версия 1.0
// ============================================================

console.log('🛍️ Магазин скинов загружается...');

// ============================================================
//  ДАННЫЕ МАГАЗИНА
// ============================================================

const SHOP_DATA = {
    // Скины для питомца
    pets: [
        {
            id: 'unicorn_default',
            name: '🦄 Единорог',
            price: 0,
            emoji: '🦄',
            default: true,
            description: 'Классический единорог'
        },
        {
            id: 'dragon',
            name: '🐉 Дракон',
            price: 100,
            emoji: '🐉',
            description: 'Огненный дракон'
        },
        {
            id: 'cat',
            name: '🐱 Кот',
            price: 50,
            emoji: '🐱',
            description: 'Космический кот'
        },
        {
            id: 'fox',
            name: '🦊 Лис',
            price: 75,
            emoji: '🦊',
            description: 'Хитрый лис'
        },
        {
            id: 'panda',
            name: '🐼 Панда',
            price: 80,
            emoji: '🐼',
            description: 'Милый панда'
        },
        {
            id: 'phoenix',
            name: '🔥 Феникс',
            price: 200,
            emoji: '🔥',
            description: 'Легендарный феникс'
        },
        {
            id: 'mermaid',
            name: '🧜‍♀️ Русалка',
            price: 150,
            emoji: '🧜‍♀️',
            description: 'Морская русалка'
        },
        {
            id: 'ghost',
            name: '👻 Призрак',
            price: 60,
            emoji: '👻',
            description: 'Призрачный питомец'
        },
        {
            id: 'alien',
            name: '👽 Инопланетянин',
            price: 120,
            emoji: '👽',
            description: 'Пришелец из космоса'
        }
    ],
    
    // Фоны
    backgrounds: [
        {
            id: 'bg_default',
            name: '🌌 Космос',
            price: 0,
            gradient: 'linear-gradient(135deg, #0a0515, #1a0e3e, #0a0515)',
            default: true,
            description: 'Классический космос'
        },
        {
            id: 'bg_sunset',
            name: '🌅 Закат',
            price: 50,
            gradient: 'linear-gradient(135deg, #ff6b6b, #ffd93d, #6c5ce7)',
            description: 'Романтичный закат'
        },
        {
            id: 'bg_forest',
            name: '🌿 Лес',
            price: 40,
            gradient: 'linear-gradient(135deg, #2d3436, #00b894, #55efc4)',
            description: 'Таинственный лес'
        },
        {
            id: 'bg_ocean',
            name: '🌊 Океан',
            price: 45,
            gradient: 'linear-gradient(135deg, #0c2461, #0984e3, #74b9ff)',
            description: 'Глубокий океан'
        },
        {
            id: 'bg_candy',
            name: '🍭 Конфетный',
            price: 60,
            gradient: 'linear-gradient(135deg, #fd79a8, #ffd93d, #a29bfe)',
            description: 'Сладкая сказка'
        },
        {
            id: 'bg_neon',
            name: '💜 Неон',
            price: 80,
            gradient: 'linear-gradient(135deg, #2d2d44, #6c5ce7, #fd79a8, #00d4ff)',
            backgroundSize: '400% 400%',
            animation: 'bgNeon 8s ease-in-out infinite',
            description: 'Неоновый город'
        },
        {
            id: 'bg_aurora',
            name: '🌌 Северное сияние',
            price: 100,
            gradient: 'linear-gradient(135deg, #0c0c2e, #2d1b69, #1a5276, #00d4ff)',
            backgroundSize: '400% 400%',
            animation: 'bgAurora 10s ease-in-out infinite',
            description: 'Магическое сияние'
        },
        {
            id: 'bg_rainbow',
            name: '🌈 Радуга',
            price: 70,
            gradient: 'conic-gradient(from 0deg, red, orange, yellow, green, blue, indigo, violet, red)',
            backgroundSize: '200% 200%',
            animation: 'bgRainbow 6s linear infinite',
            description: 'Яркая радуга'
        }
    ]
};

// ============================================================
//  СОСТОЯНИЕ МАГАЗИНА
// ============================================================

let shopState = {
    purchasedPets: ['unicorn_default'],
    activePet: 'unicorn_default',
    purchasedBgs: ['bg_default'],
    activeBg: 'bg_default'
};

function loadShopState() {
    try {
        const saved = localStorage.getItem('shopState');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Сохраняем только валидные данные
            if (parsed.purchasedPets && parsed.activePet) {
                shopState = parsed;
                // Убеждаемся, что дефолтные скины есть
                if (!shopState.purchasedPets.includes('unicorn_default')) {
                    shopState.purchasedPets.unshift('unicorn_default');
                }
                if (!shopState.purchasedBgs.includes('bg_default')) {
                    shopState.purchasedBgs.unshift('bg_default');
                }
                console.log('🛍️ Состояние магазина загружено');
                return;
            }
        }
    } catch(e) {}
    // Если ничего не загрузилось - используем дефолт
    shopState = {
        purchasedPets: ['unicorn_default'],
        activePet: 'unicorn_default',
        purchasedBgs: ['bg_default'],
        activeBg: 'bg_default'
    };
    saveShopState();
}

function saveShopState() {
    try {
        localStorage.setItem('shopState', JSON.stringify(shopState));
    } catch(e) {}
}

loadShopState();

// ============================================================
//  ПРИМЕНЕНИЕ СКИНОВ
// ============================================================

function applyPetSkin(skinId) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    // Сохраняем выбранного питомца
    shopState.activePet = skinId;
    saveShopState();
    
    // Обновляем отображение питомца
    const pet = SHOP_DATA.pets.find(p => p.id === skinId);
    if (pet) {
        // Обновляем эмодзи питомца
        const petStageEl = document.getElementById('petStage');
        if (petStageEl) {
            const currentText = petStageEl.textContent;
            // Заменяем эмодзи на новый
            const stageText = currentText.replace(/^[^\s]+\s/, '');
            petStageEl.textContent = pet.emoji + ' ' + stageText;
        }
        showToast('🦄 Скин питомца изменён на ' + pet.name);
    }
}

function applyBgSkin(bgId) {
    const bg = SHOP_DATA.backgrounds.find(b => b.id === bgId);
    if (!bg) return;
    
    shopState.activeBg = bgId;
    saveShopState();
    
    // Применяем фон к body
    const body = document.body;
    body.style.background = bg.gradient;
    body.style.backgroundSize = bg.backgroundSize || 'auto';
    if (bg.animation) {
        body.style.animation = bg.animation;
    }
    
    // Также меняем фон вкладок магазина
    const shopOverlay = document.getElementById('shopOverlay');
    if (shopOverlay) {
        shopOverlay.style.background = bg.gradient;
        shopOverlay.style.backgroundSize = bg.backgroundSize || 'auto';
        if (bg.animation) {
            shopOverlay.style.animation = bg.animation;
        }
    }
    
    showToast('🌅 Фон изменён на ' + bg.name);
}

// ============================================================
//  ОТКРЫТИЕ МАГАЗИНА
// ============================================================

function openShop() {
    // Проверяем регистрацию
    if (typeof getCurrentUser === 'function') {
        const user = getCurrentUser();
        if (!user || !user.registered) {
            showToast('❌ Сначала зарегистрируйтесь!');
            if (typeof checkRegistration === 'function') checkRegistration();
            return;
        }
    }

    const oldOverlay = document.getElementById('shopOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shopOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998;
        background: linear-gradient(135deg, #1a0e3e, #0a0515, #1a0e3e);
        background-size: 300% 300%;
        display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;
    `;

    // Стили
    let styleEl = document.getElementById('shopStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'shopStyle';
        styleEl.textContent = `
            .shop-tabs {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                justify-content: center;
            }
            .shop-tab {
                padding: 10px 25px;
                border: none;
                border-radius: 30px;
                background: rgba(255,255,255,0.05);
                color: rgba(255,255,255,0.5);
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid rgba(255,255,255,0.05);
            }
            .shop-tab:hover {
                background: rgba(255,255,255,0.1);
            }
            .shop-tab.active {
                background: rgba(255,255,255,0.1);
                color: #fff;
                border-color: rgba(255,217,61,0.2);
            }
            .shop-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                max-height: 400px;
                overflow-y: auto;
                padding-right: 5px;
            }
            .shop-grid::-webkit-scrollbar {
                width: 4px;
            }
            .shop-grid::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 10px;
            }
            .shop-item {
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                padding: 15px;
                text-align: center;
                border: 2px solid rgba(255,255,255,0.05);
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
            }
            .shop-item:hover {
                transform: translateY(-2px);
                background: rgba(255,255,255,0.08);
            }
            .shop-item.active {
                border-color: #ffd93d;
                background: rgba(255,217,61,0.05);
            }
            .shop-item.owned {
                border-color: rgba(255,217,61,0.2);
            }
            .shop-item .emoji {
                font-size: 40px;
                display: block;
                margin-bottom: 5px;
            }
            .shop-item .name {
                font-size: 14px;
                font-weight: 700;
                color: #fff;
            }
            .shop-item .price {
                font-size: 13px;
                color: #ffd93d;
                margin-top: 4px;
            }
            .shop-item .price.free {
                color: #7ed6df;
            }
            .shop-item .check {
                position: absolute;
                top: 8px;
                right: 8px;
                font-size: 14px;
            }
            .shop-item .buy-btn {
                margin-top: 8px;
                padding: 6px 15px;
                border: none;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s ease;
                background: linear-gradient(135deg, #ff6b9d, #ff2e63);
                color: #fff;
            }
            .shop-item .buy-btn:hover {
                transform: scale(1.05);
            }
            .shop-item .buy-btn:disabled {
                opacity: 0.3;
                cursor: not-allowed;
                transform: none !important;
            }
            .shop-item .buy-btn.active-btn {
                background: linear-gradient(135deg, #ffd93d, #f0932b);
                color: #1a1a2e;
            }
            .shop-item .buy-btn.owned-btn {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.5);
                cursor: default;
            }
            .shop-preview {
                text-align: center;
                padding: 15px;
                background: rgba(255,255,255,0.03);
                border-radius: 16px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.05);
            }
            .shop-preview .preview-emoji {
                font-size: 60px;
            }
            .shop-preview .preview-name {
                font-size: 18px;
                font-weight: 700;
                color: #fff;
                margin-top: 5px;
            }
            @keyframes bgNeon {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes bgAurora {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes bgRainbow {
                from { background-position: 0% 50%; }
                to { background-position: 200% 50%; }
            }
        `;
        document.head.appendChild(styleEl);
    }

    const container = document.createElement('div');
    container.style.cssText = `max-width: 500px; width: 100%; padding: 20px;`;

    const title = document.createElement('h2');
    title.textContent = '🛍️ Магазин скинов';
    title.style.cssText = `text-align: center; color: #fff; font-size: 28px; margin-bottom: 15px;`;
    container.appendChild(title);

    // Превью текущего скина
    const preview = document.createElement('div');
    preview.className = 'shop-preview';
    const activePet = SHOP_DATA.pets.find(p => p.id === shopState.activePet) || SHOP_DATA.pets[0];
    preview.innerHTML = `
        <div class="preview-emoji">${activePet.emoji}</div>
        <div class="preview-name">${activePet.name}</div>
    `;
    container.appendChild(preview);

    // Табы
    const tabs = document.createElement('div');
    tabs.className = 'shop-tabs';
    tabs.innerHTML = `
        <button class="shop-tab active" data-tab="pets">🦄 Питомцы</button>
        <button class="shop-tab" data-tab="bgs">🌅 Фоны</button>
    `;
    container.appendChild(tabs);

    // Контейнер для товаров
    const gridContainer = document.createElement('div');
    gridContainer.id = 'shopGridContainer';
    container.appendChild(gridContainer);

    // Кнопка назад
    const backBtn = document.createElement('button');
    backBtn.textContent = '⬅️ Назад';
    backBtn.style.cssText = `
        width: 100%; padding: 16px; border: none; border-radius: 20px;
        background: rgba(255,255,255,0.1); color: #fff; font-size: 18px;
        font-weight: 700; cursor: pointer; margin-top: 15px;
        transition: all 0.3s ease;
    `;
    backBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
    backBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.1)'; };
    backBtn.onclick = function() {
        const overlayEl = document.getElementById('shopOverlay');
        if (overlayEl) overlayEl.remove();
        showToast('⬅️ Возврат в главное меню');
    };
    container.appendChild(backBtn);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Рендерим питомцев по умолчанию
    renderShopItems('pets');

    // Обработчики табов
    tabs.querySelectorAll('.shop-tab').forEach(tab => {
        tab.onclick = function() {
            tabs.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            renderShopItems(this.dataset.tab);
        };
    });
}

// ============================================================
//  ОТОБРАЖЕНИЕ ТОВАРОВ В МАГАЗИНЕ
// ============================================================

function renderShopItems(type) {
    const container = document.getElementById('shopGridContainer');
    if (!container) return;

    let items = type === 'pets' ? SHOP_DATA.pets : SHOP_DATA.backgrounds;
    let purchased = type === 'pets' ? shopState.purchasedPets : shopState.purchasedBgs;
    let active = type === 'pets' ? shopState.activePet : shopState.activeBg;

    let html = '<div class="shop-grid">';

    items.forEach(item => {
        const isOwned = purchased.includes(item.id);
        const isActive = active === item.id;
        const isDefault = item.default || false;
        const price = item.price || 0;

        let buttonHtml = '';
        if (isActive) {
            buttonHtml = `<button class="buy-btn active-btn" disabled>✅ Активен</button>`;
        } else if (isOwned) {
            buttonHtml = `<button class="buy-btn active-btn" onclick="selectShopItem('${type}', '${item.id}')">📌 Выбрать</button>`;
        } else if (price === 0) {
            buttonHtml = `<button class="buy-btn" onclick="buyShopItem('${type}', '${item.id}')">🆓 Бесплатно</button>`;
        } else {
            buttonHtml = `<button class="buy-btn" onclick="buyShopItem('${type}', '${item.id}')">⭐ ${price}</button>`;
        }

        html += `
            <div class="shop-item ${isActive ? 'active' : ''} ${isOwned ? 'owned' : ''}">
                <div class="emoji">${item.emoji || '🎨'}</div>
                <div class="name">${item.name}</div>
                <div class="price ${price === 0 ? 'free' : ''}">${price === 0 ? '🆓 Бесплатно' : '⭐ ' + price}</div>
                ${isActive ? '<div class="check">✅</div>' : ''}
                ${buttonHtml}
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
//  ПОКУПКА И ВЫБОР СКИНОВ
// ============================================================

function buyShopItem(type, itemId) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) {
        showToast('❌ Игрок не найден');
        return;
    }

    const items = type === 'pets' ? SHOP_DATA.pets : SHOP_DATA.backgrounds;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const price = item.price || 0;
    const purchased = type === 'pets' ? shopState.purchasedPets : shopState.purchasedBgs;

    // Проверяем, уже куплено
    if (purchased.includes(itemId)) {
        showToast('⚠️ Уже куплено!');
        selectShopItem(type, itemId);
        return;
    }

    // Проверяем звёзды
    if (user.stars < price) {
        showToast('❌ Недостаточно звёзд! Нужно ' + price + ' ⭐');
        return;
    }

    // Покупаем
    if (price > 0) {
        user.stars -= price;
        if (typeof saveAllData === 'function') saveAllData();
        if (typeof saveToServer === 'function') saveToServer();
    }

    // Добавляем в купленные
    if (type === 'pets') {
        shopState.purchasedPets.push(itemId);
    } else {
        shopState.purchasedBgs.push(itemId);
    }
    saveShopState();

    showToast('🎉 Куплено! ' + item.name);

    // Автоматически выбираем
    selectShopItem(type, itemId);
}

function selectShopItem(type, itemId) {
    const items = type === 'pets' ? SHOP_DATA.pets : SHOP_DATA.backgrounds;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const purchased = type === 'pets' ? shopState.purchasedPets : shopState.purchasedBgs;
    if (!purchased.includes(itemId)) {
        showToast('❌ Сначала купите этот скин!');
        return;
    }

    // Применяем скин
    if (type === 'pets') {
        shopState.activePet = itemId;
        saveShopState();
        applyPetSkin(itemId);
    } else {
        shopState.activeBg = itemId;
        saveShopState();
        applyBgSkin(itemId);
    }

    showToast('✅ Выбран ' + item.name);
    renderShopItems(type);
}

// ============================================================
//  КНОПКА "МАГАЗИН" В ГЛАВНОМ МЕНЮ
// ============================================================

function addShopButton() {
    const btnGrid = document.getElementById('btnGrid');
    if (!btnGrid) {
        setTimeout(addShopButton, 500);
        return;
    }

    if (document.getElementById('btnShop')) return;

    const shopBtn = document.createElement('button');
    shopBtn.id = 'btnShop';
    shopBtn.className = 'btn full small';
    shopBtn.textContent = '🛍️ Магазин';
    shopBtn.style.cssText = `
        background: linear-gradient(135deg, #fd79a8, #e84393) !important;
        border: 2px solid rgba(255, 215, 0, 0.2) !important;
        font-size: 16px !important;
        padding: 14px !important;
        grid-column: span 3 !important;
        color: white !important;
        border-radius: 20px !important;
        cursor: pointer !important;
        font-weight: 700 !important;
        transition: all 0.3s ease !important;
    `;
    shopBtn.onclick = function() {
        openShop();
    };

    const rulesBtn = document.getElementById('btnRules');
    if (rulesBtn) {
        btnGrid.insertBefore(shopBtn, rulesBtn);
    } else {
        btnGrid.appendChild(shopBtn);
    }
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

// Применяем сохранённый фон при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const bg = SHOP_DATA.backgrounds.find(b => b.id === shopState.activeBg);
        if (bg && bg.id !== 'bg_default') {
            applyBgSkin(bg.id);
        }
    }, 500);

    setTimeout(addShopButton, 1000);
    setTimeout(addShopButton, 3000);
    setTimeout(addShopButton, 5000);
});

// Делаем функции глобальными
window.openShop = openShop;
window.buyShopItem = buyShopItem;
window.selectShopItem = selectShopItem;
window.renderShopItems = renderShopItems;

console.log('🛍️ Магазин скинов готов!');
console.log('🦄 Доступно питомцев: ' + SHOP_DATA.pets.length);
console.log('🌅 Доступно фонов: ' + SHOP_DATA.backgrounds.length);
