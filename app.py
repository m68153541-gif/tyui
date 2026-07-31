// Добавьте в начало game.js после глобальных переменных
let lastSyncTimestamp = 0;

// Функция активации кода у игрока (например, добавление звезд)
function activatePlayerCode(code) {
    if (!code) return;

    // Предположим, что код — это число звезд, которое нужно прибавить
    const starsToAdd = parseInt(code);
    if (isNaN(starsToAdd)) return;

    const user = getCurrentUser();
    if (user) {
        user.stars = (user.stars || 0) + starsToAdd;
        saveAllData();
        showToast(`🎉 Получено ${starsToAdd} звезд за использование кода!`);
        render();
    }
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

                // ===== ВАЖНО =====
                // После синхронизации активируем код, если он есть
                if (user && user.newCode) {
                    activatePlayerCode(user.newCode);
                }

                lastSyncTimestamp = data.timestamp;
            }
        }
    } catch(e) {
        console.error('❌ Ошибка синхронизации:', e);
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
                // Показываем последнее уведомление
                const last = data.notifications[data.notifications.length - 1];
                showToast(last.message);
                
                // Если это бан, обновляем статус
                if (last.type === 'ban') {
                    user.banned = true;
                    user.banned_reason = last.message;
                    render();
                }
            }
        }
    } catch(e) {
        console.error('❌ Ошибка проверки уведомлений:', e);
    }
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
