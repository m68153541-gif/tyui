from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

DATA_FILE = 'users_data.json'

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
            'registered': data.get('registered', False)
        })
    return jsonify(result)

@app.route('/api/banned_users')
def get_banned_users():
    users = load_users()
    banned = {}
    for user_id, data in users.items():
        uid = data.get('uid')
        if data.get('banned', False) and uid:
            banned[uid] = {
                'user_id': user_id,
                'reason': data.get('banned_reason', 'Нарушение правил')
            }
    return jsonify(banned)

@app.route('/api/sync_banned', methods=['POST'])
def sync_banned():
    data = request.json
    banned_data = data.get('banned', {})
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
    return jsonify({'success': True})

@app.route('/api/sync_codes', methods=['POST'])
def sync_codes():
    data = request.json
    codes_data = data.get('codes', [])
    codes_file = 'codes_data.json'
    try:
        with open(codes_file, 'w', encoding='utf-8') as f:
            json.dump(codes_data, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True})
    except:
        return jsonify({'error': 'Failed to save codes'}), 500

@app.route('/api/load_codes')
def load_codes():
    codes_file = 'codes_data.json'
    if os.path.exists(codes_file):
        try:
            with open(codes_file, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except:
            return jsonify([])
    return jsonify([])

# ===== НОВЫЙ МАРШРУТ ДЛЯ СБРОСА =====
@app.route('/api/reset', methods=['POST'])
def reset_data():
    # Сохраняем пустой объект
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)
    # Также удаляем файл с кодами
    if os.path.exists('codes_data.json'):
        os.remove('codes_data.json')
    return jsonify({'success': True, 'message': 'Все данные сброшены!'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
