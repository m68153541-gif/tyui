from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import json
import time

app = Flask(__name__)
CORS(app)

DATA_FILE = 'users_data.json'
GLOBAL_DATA_FILE = 'global_data.json'

def load_users():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_users(users):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

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

def save_global_data(data):
    with open(GLOBAL_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css')

@app.route('/game.js')
def js():
    return send_from_directory('.', 'game.js')

@app.route('/api/save', methods=['POST'])
def save_user():
    data = request.json
    user_id = data.get('user_id')
    user_data = data.get('user_data')
    
    if not user_id or not user_data:
        return jsonify({'error': 'Missing data'}), 400
    
    users = load_users()
    users[user_id] = user_data
    save_users(users)
    
    return jsonify({'success': True})

@app.route('/api/load/<user_id>')
def load_user(user_id):
    users = load_users()
    user_data = users.get(user_id)
    if user_data:
        return jsonify(user_data)
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/all_users')
def all_users():
    users = load_users()
    result = []
    for user_id, data in users.items():
        result.append({
            'user_id': user_id,
            'uid': data.get('uid', '—'),
            'name': data.get('name', '—'),
            'stars': data.get('stars', 0),
            'bank': data.get('bank', 0),
            'attempts': data.get('attempts', 0),
            'registered': data.get('registered', False),
            'banned': data.get('banned', False),
            'banned_reason': data.get('banned_reason', '')
        })
    return jsonify(result)

# ===== ГЛОБАЛЬНЫЕ ДАННЫЕ =====

@app.route('/api/get_global_data')
def get_global_data():
    data = load_global_data()
    return jsonify(data)

@app.route('/api/set_contest', methods=['POST'])
def set_contest():
    data = request.json
    global_data = load_global_data()
    global_data['contest_active'] = data.get('active', False)
    global_data['contest_end_time'] = data.get('end_time')
    global_data['contest_winner'] = data.get('winner')
    save_global_data(global_data)
    return jsonify({'success': True})

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

@app.route('/api/clear_reports', methods=['POST'])
def clear_reports():
    global_data = load_global_data()
    global_data['reports'] = []
    save_global_data(global_data)
    return jsonify({'success': True})

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

@app.route('/api/get_chat/<uid>')
def get_chat(uid):
    global_data = load_global_data()
    if 'active_chats' in global_data and uid in global_data['active_chats']:
        return jsonify(global_data['active_chats'][uid])
    return jsonify({'messages': [], 'admin': False})

@app.route('/api/close_chat', methods=['POST'])
def close_chat():
    data = request.json
    uid = data.get('uid')
    global_data = load_global_data()
    if 'active_chats' in global_data and uid in global_data['active_chats']:
        del global_data['active_chats'][uid]
        save_global_data(global_data)
    return jsonify({'success': True})

@app.route('/api/add_code', methods=['POST'])
def add_code():
    data = request.json
    global_data = load_global_data()
    if 'admin_codes' not in global_data:
        global_data['admin_codes'] = []
    global_data['admin_codes'].append({
        'code': data.get('code'),
        'type': data.get('type'),
        'target': data.get('target')
    })
    save_global_data(global_data)
    return jsonify({'success': True})

@app.route('/api/delete_code', methods=['POST'])
def delete_code():
    data = request.json
    code = data.get('code')
    global_data = load_global_data()
    if 'admin_codes' in global_data:
        global_data['admin_codes'] = [c for c in global_data['admin_codes'] if c.get('code') != code]
        save_global_data(global_data)
    return jsonify({'success': True})

@app.route('/api/sync_banned', methods=['POST'])
def sync_banned():
    data = request.json
    banned_data = data.get('banned', {})
    global_data = load_global_data()
    global_data['banned_users'] = banned_data
    
    # Обновляем banned статус в users
    users = load_users()
    for user_id, user_data in users.items():
        uid = user_data.get('uid')
        if uid and uid in banned_data:
            user_data['banned'] = True
            user_data['banned_reason'] = banned_data[uid]
        elif uid:
            user_data['banned'] = False
            user_data['banned_reason'] = ''
    save_users(users)
    
    save_global_data(global_data)
    return jsonify({'success': True})

@app.route('/api/reset', methods=['POST'])
def reset_data():
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    if os.path.exists(GLOBAL_DATA_FILE):
        os.remove(GLOBAL_DATA_FILE)
    return jsonify({'success': True, 'message': 'Все данные сброшены!'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
