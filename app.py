// Добавьте в начало game.js после глобальных переменных
let lastSyncTimestamp = 0;

// Функция активации кода у игрока (добавление попыток или звёзд)
function activatePlayerCode(codeData) {
    if (!codeData) return false;
    
    const user = getCurrentUser();
    if (!user) return false;
    
    // Проверяем тип кода
    if (codeData.type === 'stars') {
        // Добавляем звёзды
        const starsToAdd = parseInt(codeData.value) || 0;
        if (starsToAdd > 0) {
            user.stars = (user.stars || 0) + starsToAdd;
            showToast(`🎉 Получено ${starsToAdd} звёзд за использование кода!`);
            saveAllData();
            render();
            return true;
        }
    } else if (codeData.type === 'attempts') {
        // Добавляем попытки
        const attemptsToAdd = parseInt(codeData.value) || 1;
        user.attempts = (user.attempts || 0) + attemptsToAdd;
        showToast(`🎉 Получено ${attemptsToAdd} попыток за использование кода!`);
        saveAllData();
        render();
        return true;
    } else if (codeData.type === 'boost') {
        // Активируем бустер
        user.boosted = true;
        user.attempts = (user.attempts || 0) + 1;
        showToast('🚀 Бустер активирован! +1 попытка');
        saveAllData();
        render();
        return true;
    }
    
    return false;
}

// Обновленная функция синхронизации с сервером
async function syncWithServer() {
    try {
        // Проверяем обновления
        const response = await fetch(`${SERVER_URL}/api/check_updates?timestamp=${lastSyncTimestamp}`);
        if (response.ok) {
            const data = await response.json();
            if (data.has_updates) {
                // Обновляем глобальные данные
                if (data.global_data) {
                    window.globalData = data.global_data;
                    // Обновляем баны
                    if (data.global_data.banned_users) {
                        window.bannedUsers = data.global_data.banned_users;
                    }
                }
                
                // Обновляем данные пользователя
                const user = getCurrentUser();
                if (user && user.uid) {
                    await loadFromServer();
                }
                
                // Проверяем уведомления
                await checkNotifications();
                
                // Обновляем отображение
                render();

                // Проверяем наличие нового кода для активации
                if (user && user.pendingCode) {
                    const codeData = user.pendingCode;
                    // Удаляем код после активации
                    delete user.pendingCode;
                    saveAllData();
                    activatePlayerCode(codeData);
                }

                lastSyncTimestamp = data.timestamp;
            }
        }
    } catch(e) {
        console.error('Ошибка синхронизации:', e);
    }
}

// Проверка уведомлений
async function checkNotifications() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/get_notifications/${user.uid}`);
        if (response.ok) {
            const data = await response.json();
            if (data.notifications && data.notifications.length > 0) {
                // Показываем все уведомления по очереди
                data.notifications.forEach((notification, index) => {
                    setTimeout(() => {
                        showToast(notification.message);
                    }, index * 3000);
                });
                
                // Если есть бан, обновляем статус
                const banNotification = data.notifications.find(n => n.type === 'ban');
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

// Функция для отправки кода на сервер (для администратора)
async function sendCodeToPlayer(uid, codeData) {
    try {
        const response = await fetch(`${SERVER_URL}/api/send_code_to_player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: uid,
                code: codeData
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast('✅ Код отправлен игроку!');
                return true;
            } else {
                showToast('❌ Ошибка: ' + result.message);
                return false;
            }
        }
    } catch(e) {
        console.error('Ошибка отправки кода:', e);
        showToast('❌ Ошибка отправки кода');
        return false;
    }
}

// Функция для активации кода на сервере (для игрока)
async function activateCodeOnServer(code) {
    try {
        const user = getCurrentUser();
        const response = await fetch(`${SERVER_URL}/api/use_code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                user_id: getUserId(),
                user_uid: user ? user.uid : null
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast(result.message || '✅ Код активирован!');
                // Обновляем данные после активации
                await loadFromServer();
                render();
                return true;
            } else {
                showToast(result.message || '❌ Ошибка активации кода');
                return false;
            }
        }
    } catch(e) {
        console.error('Ошибка активации кода:', e);
        showToast('❌ Ошибка активации кода');
        return false;
    }
}

// Функция для получения уведомлений
async function getNotifications() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;
    
    try {
        const response = await fetch(`${SERVER_URL}/api/get_notifications/${user.uid}`);
        if (response.ok) {
            const data = await response.json();
            if (data.notifications) {
                return data.notifications;
            }
        }
    } catch(e) {
        console.error('Ошибка получения уведомлений:', e);
    }
    return [];
}

// Вызов синхронизации каждые 5 секунд
setInterval(async () => {
    await syncWithServer();
}, 5000);

// Вызов синхронизации при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        await syncWithServer();
    }, 1000);
});

// Переопределяем функцию applyCode для работы с сервером
window.applyCode = async function() {
    const user = getCurrentUser();
    const input = document.getElementById('codeInput');
    if (!input) return;
    const text = input.value.trim().toUpperCase();
    if (!text) { 
        showToast('❌ Введите код'); 
        return; 
    }
    
    // Отправляем код на сервер
    const success = await activateCodeOnServer(text);
    if (success) {
        closeModal();
    }
};

// Добавляем функцию для копирования кода
window.copyCode = function(code) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('✅ Код скопирован!');
        }).catch(() => {
            fallbackCopyCode(code);
        });
    } else {
        fallbackCopyCode(code);
    }
};

function fallbackCopyCode(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('✅ Код скопирован!');
};
