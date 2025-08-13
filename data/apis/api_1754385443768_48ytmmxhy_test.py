from flask import Flask, jsonify

app = Flask(__name__)

# Simple GET endpoint
@app.route('/api/hello', methods=['GET'])
def hello():
    return jsonify({
        'message': 'Hello, world!'
    })

if __name__ == '__main__':
    app.run(debug=True)
