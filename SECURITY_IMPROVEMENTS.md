# Security Improvements and Configuration Guide

## Overview
This document outlines the security improvements made to the API endpoints and the required configuration for production deployment.

## Security Issues Fixed

### 1. Hardcoded SECRET_KEY
**Issue**: SECRET_KEY was hardcoded as 'supersecretkey' in the API files.
**Fix**: 
- SECRET_KEY now reads from environment variable `SECRET_KEY`
- Application fails to start in production if SECRET_KEY is not set
- For development/testing, generates a random 32-byte hex key as fallback

**Required Environment Variable**:
```bash
SECRET_KEY=your_secure_random_secret_key_here
```

**Recommendation**: Use a cryptographically secure random generator:
```bash
# Generate a secure secret key
openssl rand -hex 32
# or
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Debug Mode in Production
**Issue**: Flask apps were running with `debug=True` which enables debugger and reloader.
**Fix**: 
- Debug mode controlled by `FLASK_DEBUG` environment variable
- Defaults to `False` for security
- Only enabled when explicitly set to 'true', '1', or 'yes'

**Environment Variables**:
```bash
FLASK_DEBUG=false  # Default, recommended for production
FLASK_HOST=127.0.0.1  # Optional, defaults to 127.0.0.1
FLASK_PORT=5000  # Optional, defaults to 5000
```

### 3. Weak bcrypt Work Factor
**Issue**: bcrypt.gensalt() used default work factor (10).
**Fix**: 
- Explicitly set work factor to 12 rounds
- Provides stronger password hashing with reasonable performance

**Code Change**:
```python
# Before
hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# After  
hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
```

### 4. Broad Exception Handling in JWT Verification
**Issue**: Bare `except:` clause caught all exceptions, hiding specific JWT errors.
**Fix**: 
- Catch specific JWT exceptions: `ExpiredSignatureError`, `InvalidTokenError`, `DecodeError`
- Return appropriate HTTP status codes and error messages
- Log specific errors for diagnostics
- Generic exception handler for unexpected errors

**Exception Handling**:
```python
try:
    data = jwt.decode(token_value, secret_key, algorithms=["HS256"])
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
```

### 5. MongoDB Connection Security
**Issue**: MongoDB connection lacked authentication and error handling.
**Fix**: 
- Support for authenticated connections via environment variables
- Proper connection timeout settings
- Connection testing with error handling
- Graceful failure if connection cannot be established

**Environment Variables**:
```bash
MONGODB_URI=mongodb://localhost:27017/  # Default
MONGODB_USERNAME=your_mongodb_username  # Optional
MONGODB_PASSWORD=your_mongodb_password  # Optional
```

**Connection Configuration**:
```python
client = MongoClient(
    mongodb_uri,
    username=mongodb_username,  # If provided
    password=mongodb_password,  # If provided
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000
)
```

### 6. Input Validation
**Issue**: Direct access to request data without validation could cause crashes.
**Fix**: 
- Validate JSON data exists and is a dictionary
- Check required fields exist and are non-empty strings
- Return appropriate error messages for missing/invalid fields
- Use `request.get_json(silent=True)` to handle malformed JSON gracefully

**Validation Example**:
```python
data = request.get_json(silent=True)

if not data or not isinstance(data, dict):
    return jsonify({'error': 'Invalid JSON data'}), 400

if not data.get('email') or not data.get('password'):
    missing_fields = []
    if not data.get('email'):
        missing_fields.append('email')
    if not data.get('password'):
        missing_fields.append('password')
    return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
```

### 7. Next.js Package Externalization
**Issue**: `onnxruntime-node` native addon was being bundled with Next.js server.
**Fix**: 
- Added `serverExternalPackages: ['onnxruntime-node']` to Next.js config
- Native addon is now required at runtime rather than bundled

## Production Deployment Checklist

### Environment Variables Required
```bash
# Security
SECRET_KEY=<secure_random_32_byte_hex>

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=false

# MongoDB (if using authentication)
MONGODB_URI=mongodb://username:password@host:port/database
MONGODB_USERNAME=your_username
MONGODB_PASSWORD=your_password

# Optional Flask Configuration
FLASK_HOST=0.0.0.0  # If binding to all interfaces
FLASK_PORT=5000
```

### Security Recommendations
1. **Never commit SECRET_KEY to version control**
2. **Use environment variables or secret management systems**
3. **Set FLASK_DEBUG=false in production**
4. **Use authenticated MongoDB connections in production**
5. **Implement proper logging and monitoring**
6. **Use HTTPS in production**
7. **Regular security audits and dependency updates**

### Testing
- Test with `FLASK_DEBUG=false` to ensure no debug information leaks
- Verify JWT token handling with expired, invalid, and malformed tokens
- Test MongoDB connection failure scenarios
- Validate input validation with malformed JSON and missing fields

## Logging
The applications now include comprehensive logging:
- Connection status and errors
- JWT verification failures
- Input validation errors
- General application startup information

Logs are configured at INFO level by default and can be adjusted via environment variables.

## Dependencies
Ensure the following Python packages are installed:
```bash
pip install flask pyjwt bcrypt pymongo
```

## Monitoring
Monitor the following in production:
- JWT verification failures (potential security attacks)
- MongoDB connection issues
- Input validation failures (potential abuse)
- Application startup and configuration errors
