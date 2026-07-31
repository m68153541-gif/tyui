// Добавьте в начало game.js после глобальных переменных
let lastSyncTimestamp = 0;

// Функция синхронизации с сервером
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
                    // Загружаем свежие данные пользователя
                    await loadFromServer();
                }
                
                // Проверяем уведомления
                await checkNotifications();
                
                // Обновляем отображение
                render();
                lastSyncTimestamp = data.timestamp;
            }
        }
    } catch(e) {
        console.error('❌ Ошибка синхронизации:', e);
    }
}

// Функция проверки уведомлений
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

// Добавляем периодическую синхронизацию
setInterval(async () => {
    await syncWithServer();
}, 5000); // Каждые 5 секунд

// Синхронизация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // ... существующий код ...
    
    // Запускаем синхронизацию
    setTimeout(async () => {
        await syncWithServer();
    }, 1000);
});
