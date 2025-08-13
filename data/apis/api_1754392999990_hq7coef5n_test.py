from flask import Flask, request, jsonify
from functools import wraps
import jwt
import datetime
import bcrypt
from pymongo import MongoClient

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'

# MongoDB setup
client = MongoClient('mongodb://localhost:27017/')
db = client['userdb']
users_collection = db['users']

# JWT decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            data = jwt.decode(token.split(" ")[1], app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'email': data['email']})
        except:
            return jsonify({'error': 'Token is invalid or expired'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

# Role-based access control
def admin_only(f):
    @wraps(f)
    def decorated(user, *args, **kwargs):
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(user, *args, **kwargs)
    return decorated

# POST /api/register (Admin only)
@app.route('/api/register', methods=['POST'])
@token_required
@admin_only
def register_user(current_user):
    data = request.get_json()
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    existing_user = users_collection.find_one({'email': data['email']})
    if existing_user:
        return jsonify({'error': 'User already exists'}), 409

    hashed_pw = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

    user = {
        'email': data['email'],
        'password': hashed_pw,
        'role': data.get('role', 'user'),
        'created_at': datetime.datetime.utcnow()
    }

    users_collection.insert_one(user)
    return jsonify({'message': 'User registered successfully'}), 201

# GET /api/profile
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'email': current_user['email'],
        'role': current_user['role'],
        'created_at': current_user['created_at']
    })

# POST /api/login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = users_collection.find_one({'email': data['email']})
    if not user or not bcrypt.checkpw(data['password'].encode('utf-8'), user['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({'token': token})

if __name__ == '__main__':
    app.run(debug=True)
