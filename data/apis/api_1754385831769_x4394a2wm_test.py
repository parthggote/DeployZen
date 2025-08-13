from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory data store
tasks = []

# GET: Fetch all tasks
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify({'tasks': tasks}), 200

# POST: Add a new task
@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.get_json()

    if not data or 'title' not in data:
        return jsonify({'error': 'Task title is required'}), 400

    task = {
        'id': len(tasks) + 1,
        'title': data['title'],
        'completed': False
    }
    tasks.append(task)
    return jsonify({'message': 'Task added', 'task': task}), 201

# GET: Fetch task by ID
@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    task = next((t for t in tasks if t['id'] == task_id), None)
    if task is None:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task), 200

if __name__ == '__main__':
    app.run(debug=True)
