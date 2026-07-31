// Функция проверки бана при загрузке
async function checkBanStatus() {
    const user = getCurrentUser();
    if (!user || !user.uid) return;
    
    try {
        const response = await fetch(SERVER_URL + '/api/load/' + getUserId());
        if (response.ok) {
            const data = await response.json();
            if (data.banned) {
                user.banned = true;
                user.banned_reason = data.banned_reason || 'Нарушение правил';
                showToast('🚫 Вы заблокированы. Причина: ' + user.banned_reason);
                render();
                saveAllData();
                return true;
            } else {
                if (user.banned) {
                    user.banned = false;
                    user.banned_reason = '';
                    render();
                    saveAllData();
                }
            }
        }
    } catch(e) {
        console.error('Ошибка проверки бана:', e);
    }
    return false;
}

// Переопределяем функцию рендера для отображения статуса бана
const originalRender = render;
render = function() {
    originalRender();
    const user = getCurrentUser();
    if (user && user.banned) {
        const statusEl = document.getElementById('userRegStatus');
        if (statusEl) {
            statusEl.textContent = '🚫 ЗАБЛОКИРОВАН: ' + (user.banned_reason || 'Нарушение правил');
            statusEl.style.color = '#ff4757';
        }
    }
};

// Проверяем бан при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async function() {
        await checkBanStatus();
        await syncWithServer();
    }, 500);
});

// Проверяем бан каждые 10 секунд
setInterval(async function() {
    await checkBanStatus();
}, 10000);
