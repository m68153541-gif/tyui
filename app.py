from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import json
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATA_FILE = 'users_data.json'
GLOBAL_DATA_FILE = 'global_data.json'

# Загрузка данных о пользователях
def load_users():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

# Сохранение данных о пользователях
def save_users(users):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

# Загрузка глобальных данных
def load_global_data():
    if os.path.exists(GLOBAL_DATA_FILE):
        try:
            with open(GLOBAL_DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {
        'contest_active': False,
        'contest_end_time': None,
        'contest_winner': None,
        'admin_codes': [],
        'reports': [],
        'active_chats': {},
        'banned_users': {}
    }

# Сохранение глобальных данных
def save_global_data(data):
    with open(GLOBAL_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Основные маршруты
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css')

@app.route('/game.js')
def js():
    return send_from_directory('.', 'game.js')

# API: сохранить пользователя
@app.route('/api/save', methods=['POST'])
def save_user():
    data = request.json
    user_id = data.get('user_id')
    user_data = data.get('user_data')
    if not user_id or not user_data:
        return jsonify({'error': 'Missing data'}), 400
    
    users = load_users()
    
    if 'uid' in user_data:
        global_data = load_global_data()
        uid = user_data.get('uid')
        
        if uid and uid in global_data.get('banned_users', {}):
            user_data['banned'] = True
            user_data['banned_reason'] = global_data['banned_users'][uid]
        
        users[user_id] = user_data
        save_users(users)
        return jsonify({'success': True, 'timestamp': time.time()})
    
    return jsonify({'error': 'No uid'}), 400

# API: загрузить пользователя по id
@app.route('/api/load/<user_id>')
def load_user(user_id):
    users = load_users()
    global_data = load_global_data()
    user_data = users.get(user_id)
    
    if user_data:
        uid = user_data.get('uid')
        if uid and uid in global_data.get('banned_users', {}):
            user_data['banned'] = True
            user_data['banned_reason'] = global_data['banned_users'][uid]
            users[user_id] = user_data
            save_users(users)
        
        return jsonify(user_data)
    return jsonify({'error': 'Not found'}), 404

# API: все пользователи
@app.route('/api/all_users')
def all_users():
    users = load_users()
    global_data = load_global_data()
    result = []
    
    for user_id, data in users.items():
        uid = data.get('uid')
        if uid:
            is_banned = uid in global_data.get('banned_users', {})
            banned_reason = global_data.get('banned_users', {}).get(uid, '')
            
            # Считаем общее количество звёзд (баланс + банк)
            stars = data.get('stars', 0)
            bank = data.get('bank', 0)
            total_stars = stars + bank
            
            result.append({
                'user_id': user_id,
                'uid': uid,
                'name': data.get('name', '—'),
                'stars': stars,
                'bank': bank,
                'total_stars': total_stars,
                'attempts': data.get('attempts', 0),
                'registered': data.get('registered', False),
                'banned': is_banned,
                'banned_reason': banned_reason
            })
    
    # Сортируем по общему количеству звёзд
    result.sort(key=lambda x: x['total_stars'], reverse=True)
    return jsonify(result)

# API: получить глобальные данные
@app.route('/api/get_global_data')
def get_global_data():
    data = load_global_data()
    return jsonify(data)

# API: установить активность конкурса
@app.route('/api/set_contest', methods=['POST'])
def set_contest():
    data = request.json
    global_data = load_global_data()
    global_data['contest_active'] = data.get('active', False)
    global_data['contest_end_time'] = data.get('end_time')
    global_data['contest_winner'] = data.get('winner')
    save_global_data(global_data)
    return jsonify({'success': True})

# API: добавление жалобы
@app.route('/api/add_report', methods=['POST'])
def add_report():
    data = request.json
    global_data = load_global_data()
    if 'reports' not in global_data:
        global_data['reports'] = []
    global_data['reports'].append({
        'uid': data.get('uid'),
        'username': data.get('username'),
        'text': data.get('text'),
        'time': data.get('time', str(time.time()))
    })
    save_global_data(global_data)
    return jsonify({'success': True})

# API: очистить жалобы
@app.route('/api/clear_reports', methods=['POST'])
def clear_reports():
    global_data = load_global_data()
    global_data['reports'] = []
    save_global_data(global_data)
    return jsonify({'success': True})

# API: чат - добавить сообщение
@app.route('/api/add_chat_message', methods=['POST'])
def add_chat_message():
    data = request.json
    uid = data.get('uid')
    message = data.get('message')
    sender = data.get('sender', 'user')
    
    global_data = load_global_data()
    if 'active_chats' not in global_data:
        global_data['active_chats'] = {}
    if uid not in global_data['active_chats']:
        global_data['active_chats'][uid] = {'messages': [], 'admin': False}
    
    global_data['active_chats'][uid]['messages'].append({
        'from': sender,
        'text': message,
        'time': data.get('time', str(time.time()))
    })
    
    if sender == 'admin':
        global_data['active_chats'][uid]['admin'] = True
    
    save_global_data(global_data)
    return jsonify({'success': True})

# API: получить чат по uid
@app.route('/api/get_chat/<uid>')
def get_chat(uid):
    global_data = load_global_data()
    chat = global_data.get('active_chats', {}).get(uid)
    if chat:
        return jsonify(chat)
    return jsonify({'messages': [], 'admin': False})

# API: закрыть чат
@app.route('/api/close_chat', methods=['POST'])
def close_chat():
    data = request.json
    uid = data.get('uid')
    global_data = load_global_data()
    if 'active_chats' in global_data and uid in global_data['active_chats']:
        del global_data['active_chats'][uid]
        save_global_data(global_data)
    return jsonify({'success': True})

# API: добавить код
@app.route('/api/add_code', methods=['POST'])
def add_code():
    data = request.json
    global_data = load_global_data()
    if 'admin_codes' not in global_data:
        global_data['admin_codes'] = []
    
    code_info = {
        'code': data.get('code'),
        'type': data.get('type'),
        'target': data.get('target'),
        'created_at': time.time(),
        'used': False,
        'used_by': []  # Список UID, кто использовал код
    }
    
    # Если код для конкретного игрока, добавляем уведомление
    target = data.get('target')
    if target and target != 'всем' and target != 'all' and '→' not in target:
        users = load_users()
        for user_id, user_data in users.items():
            if user_data.get('uid') == target:
                if 'notifications' not in user_data:
                    user_data['notifications'] = []
                user_data['notifications'].append({
                    'type': 'code',
                    'code': data.get('code'),
                    'message': 'Вам отправлен код: ' + data.get('code'),
                    'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
                save_users(users)
                break
    
    global_data['admin_codes'].append(code_info)
    save_global_data(global_data)
    return jsonify({'success': True, 'code': data.get('code')})

# API: удалить код
@app.route('/api/delete_code', methods=['POST'])
def delete_code():
    data = request.json
    code_value = data.get('code')
    global_data = load_global_data()
    if 'admin_codes' in global_data:
        global_data['admin_codes'] = [c for c in global_data['admin_codes'] if c.get('code') != code_value]
        save_global_data(global_data)
    return jsonify({'success': True})

# API: использовать код
@app.route('/api/use_code', methods=['POST'])
def use_code():
    data = request.json
    code_value = data.get('code')
    user_id = data.get('user_id')
    user_uid = data.get('user_uid')
    
    if not code_value or not user_id:
        return jsonify({'success': False, 'message': 'Missing data'}), 400
    
    global_data = load_global_data()
    users = load_users()
    
    # Ищем код
    code_obj = None
    code_index = -1
    for i, c in enumerate(global_data.get('admin_codes', [])):
        if c.get('code') == code_value and not c.get('used', False):
            code_obj = c
            code_index = i
            break
    
    if not code_obj:
        return jsonify({'success': False, 'message': 'Код не найден или уже использован'}), 404
    
    # Проверяем, не использовал ли уже этот игрок код
    if user_uid in code_obj.get('used_by', []):
        return jsonify({'success': False, 'message': 'Вы уже использовали этот код'}), 403
    
    # Проверяем target
    target = code_obj.get('target')
    if target and target != 'всем' and target != 'all':
        if '→' in target:
            target_uid = target.split('→')[-1].strip()
        else:
            target_uid = target
        
        if target_uid != user_uid:
            return jsonify({'success': False, 'message': 'Этот код не для вас'}), 403
    
    # Получаем пользователя
    user = users.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    
    # Определяем тип кода и добавляем бонус
    code_type = code_obj.get('type', '')
    message = 'Код активирован!'
    
    if 'Одноразовый' in code_type or 'Код 1' in code_type or 'single' in code_type:
        user['attempts'] = user.get('attempts', 0) + 1
        message = '+1 попытка!'
    elif 'На 5' in code_type or 'Код 5' in code_type or 'multi' in code_type:
        user['attempts'] = user.get('attempts', 0) + 5
        message = '+5 попыток!'
    elif 'Бустер' in code_type and 'x5' not in code_type:
        user['attempts'] = user.get('attempts', 0) + 1
        user['boosted'] = True
        message = 'Бустер активирован! +1 попытка'
    elif 'Бустер x5' in code_type or 'boostmulti' in code_type:
        user['attempts'] = user.get('attempts', 0) + 5
        user['boosted'] = True
        message = 'Бустер x5 активирован! +5 попыток'
    else:
        user['attempts'] = user.get('attempts', 0) + 1
        message = 'Код активирован! +1 попытка'
    
    # Добавляем пользователя в список использовавших
    code_obj['used_by'].append(user_uid)
    
    # Если код одноразовый и его использовали - помечаем как использованный
    if 'Одноразовый' in code_type or 'single' in code_type:
        code_obj['used'] = True
    
    # Если мультикод и количество использований достигло лимита
    if 'На 5' in code_type or 'multi' in code_type:
        if len(code_obj['used_by']) >= 5:
            code_obj['used'] = True
    
    # Обновляем глобальные данные
    global_data['admin_codes'][code_index] = code_obj
    save_global_data(global_data)
    
    # Добавляем уведомление
    if 'notifications' not in user:
        user['notifications'] = []
    user['notifications'].append({
        'type': 'code_used',
        'message': message,
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })
    
    # Сохраняем пользователя
    users[user_id] = user
    save_users(users)
    
    return jsonify({'success': True, 'message': message})

# API: синхронизация банов
@app.route('/api/sync_banned', methods=['POST'])
def sync_banned():
    data = request.json
    banned_data = data.get('banned', {})
    
    global_data = load_global_data()
    global_data['banned_users'] = banned_data
    save_global_data(global_data)
    
    users = load_users()
    for user_id, user_data in users.items():
        uid = user_data.get('uid')
        if uid and uid in banned_data:
            user_data['banned'] = True
            user_data['banned_reason'] = banned_data[uid]
            if 'notifications' not in user_data:
                user_data['notifications'] = []
            user_data['notifications'].append({
                'type': 'ban',
                'message': 'Вы заблокированы. Причина: ' + banned_data[uid],
                'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
        else:
            user_data['banned'] = False
            user_data['banned_reason'] = ''
    save_users(users)
    
    return jsonify({'success': True})

# API: отправить уведомление
@app.route('/api/send_notification', methods=['POST'])
def send_notification():
    data = request.json
    uid = data.get('uid')
    message = data.get('message')
    
    users = load_users()
    for user_id, user_data in users.items():
        if user_data.get('uid') == uid:
            if 'notifications' not in user_data:
                user_data['notifications'] = []
            user_data['notifications'].append({
                'type': 'notification',
                'message': message,
                'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
            save_users(users)
            break
    
    return jsonify({'success': True})

# API: получить уведомления
@app.route('/api/get_notifications/<uid>')
def get_notifications(uid):
    users = load_users()
    for user_id, user_data in users.items():
        if user_data.get('uid') == uid:
            notifications = user_data.get('notifications', [])
            return jsonify({'notifications': notifications})
    return jsonify({'notifications': []})

# API: очистить уведомления
@app.route('/api/clear_notifications/<uid>', methods=['POST'])
def clear_notifications(uid):
    users = load_users()
    for user_id, user_data in users.items():
        if user_data.get('uid') == uid:
            user_data['notifications'] = []
            save_users(users)
            break
    return jsonify({'success': True})

# API: проверка обновлений
@app.route('/api/check_updates')
def check_updates():
    global_data = load_global_data()
    users = load_users()
    
    return jsonify({
        'has_updates': True,
        'timestamp': time.time(),
        'global_data': global_data,
        'users': users
    })

# API: сброс всех данных
@app.route('/api/reset', methods=['POST'])
def reset():
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    if os.path.exists(GLOBAL_DATA_FILE):
        os.remove(GLOBAL_DATA_FILE)
    return jsonify({'success': True, 'message': 'Все данные сброшены'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
