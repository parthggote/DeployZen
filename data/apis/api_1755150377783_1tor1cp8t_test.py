from flask import Flask, request, jsonify
from functools import wraps
import jwt
import datetime
import bcrypt
import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# SECRET_KEY from environment variable - fail if not provided in production
secret_key = os.environ.get('SECRET_KEY')
if not secret_key:
    if os.environ.get('FLASK_ENV') == 'production':
        raise ValueError("SECRET_KEY environment variable must be set in production")
    else:
        # Only for development/testing - generate a random key
        import secrets
        secret_key = secrets.token_hex(32)
        logger.warning("Using generated SECRET_KEY for development - set FLASK_SECRET_KEY for production")

app.config['SECRET_KEY'] = secret_key

# MongoDB setup with proper error handling and credentials
mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')
mongodb_username = os.environ.get('MONGODB_USERNAME')
mongodb_password = os.environ.get('MONGODB_PASSWORD')

try:
    if mongodb_username and mongodb_password:
        # Use authenticated connection
        client = MongoClient(
            mongodb_uri,
            username=mongodb_username,
            password=mongodb_password,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
    else:
        # Use unauthenticated connection (not recommended for production)
        client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
    
    # Test connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    logger.error(f"Failed to connect to MongoDB: {e}")
    raise
except Exception as e:
    logger.error(f"Unexpected error connecting to MongoDB: {e}")
    raise

db = client['userdb']
users_collection = db['users']

# JWT decorator with specific exception handling
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        
        try:
            # Extract token from "Bearer <token>" format
            if not token.startswith('Bearer '):
                return jsonify({'error': 'Invalid token format'}), 401
            
            token_value = token.split(" ")[1]
            data = jwt.decode(token_value, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'email': data['email']})
            
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            return jsonify({'error': 'Token is invalid'}), 401
        except jwt.DecodeError as e:
            logger.warning(f"JWT decode error: {e}")
            return jsonify({'error': 'Token is malformed'}), 401
        except Exception as e:
            logger.error(f"Unexpected error during JWT verification: {e}")
            return jsonify({'error': 'Internal server error'}), 500
            
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
    # Environment-controlled debug mode - default to False for security
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1', 'yes')
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_PORT', 5000))
    
    logger.info(f"Starting Flask app with debug={debug_mode}")
    app.run(host=host, port=port, debug=debug_mode)
