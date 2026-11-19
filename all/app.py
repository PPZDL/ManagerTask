import sqlite3
from flask import Flask, render_template, request, g, jsonify

app = Flask(__name__)
DATABASE = 'database.db'
TASK_FIELDS = ('title', 'description', 'project_id', 'assignee_id', 'priority', 'status', 'date')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_connection(e):
    db = g.pop('db', None)
    if db: db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tg TEXT, phone TEXT);
            CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT,
                project_id INTEGER, assignee_id INTEGER, priority TEXT DEFAULT 'Средний', status TEXT DEFAULT 'Новая', date TEXT,
                FOREIGN KEY (project_id) REFERENCES projects (id), FOREIGN KEY (assignee_id) REFERENCES employees (id));
        ''')
        if db.execute('SELECT COUNT(*) FROM employees').fetchone()[0] == 0:
            db.executemany('INSERT INTO employees (name, tg, phone) VALUES (?, ?, ?)',
                           [('Иванов Иван', '@ivan', '+79991112233'), ('Петрова Анна', '@anna', '+79994445566')])
            db.executemany('INSERT INTO projects (name) VALUES (?)', [('Учебный проект',), ('Личные дела',)])
        db.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/employees', methods=['GET', 'POST'])
def employees():
    db = get_db()
    if request.method == 'POST':
        d = request.json
        db.execute('INSERT INTO employees (name, tg, phone) VALUES (?, ?, ?)', (d['name'], d['tg'], d['phone']))
        db.commit()
        return jsonify(status='ok')
    return jsonify([dict(e) for e in db.execute('SELECT * FROM employees').fetchall()])

@app.route('/api/employees/<int:id>', methods=['DELETE'])
def delete_employee(id):
    db = get_db(); db.execute('DELETE FROM employees WHERE id = ?', (id,)); db.commit()
    return jsonify(status='ok')

@app.route('/api/projects', methods=['GET', 'POST'])
def projects():
    db = get_db()
    if request.method == 'POST':
        db.execute('INSERT INTO projects (name) VALUES (?)', (request.json['name'],)); db.commit()
        return jsonify(status='ok')
    return jsonify([dict(p) for p in db.execute('SELECT * FROM projects').fetchall()])

@app.route('/api/projects/<int:id>', methods=['DELETE'])
def delete_project(id):
    db = get_db(); db.execute('DELETE FROM projects WHERE id = ?', (id,)); db.commit()
    return jsonify(status='ok')

@app.route('/api/tasks', methods=['GET', 'POST'])
def tasks():
    db = get_db()
    if request.method == 'POST':
        d = request.json
        db.execute(f'INSERT INTO tasks ({", ".join(TASK_FIELDS)}) VALUES (?, ?, ?, ?, ?, ?, ?)',
                   tuple(d[f] for f in TASK_FIELDS))
        db.commit()
        return jsonify(status='ok')
    rows = db.execute('''SELECT tasks.*, employees.name as assignee_name, projects.name as project_name
                         FROM tasks LEFT JOIN employees ON tasks.assignee_id = employees.id
                         LEFT JOIN projects ON tasks.project_id = projects.id''').fetchall()
    return jsonify([dict(t) for t in rows])

@app.route('/api/tasks/<int:id>', methods=['PUT', 'DELETE'])
def task_detail(id):
    db = get_db()
    if request.method == 'PUT':
        d = request.json
        db.execute(f'UPDATE tasks SET {", ".join(f + "=?" for f in TASK_FIELDS)} WHERE id=?',
                   tuple(d[f] for f in TASK_FIELDS) + (id,))
    else:
        db.execute('DELETE FROM tasks WHERE id = ?', (id,))
    db.commit()
    return jsonify(status='ok')

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)