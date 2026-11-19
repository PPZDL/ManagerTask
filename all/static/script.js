let tasks = [], projects = [], employees = [], editIndex = -1;
const $ = id => document.getElementById(id);

async function api(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.ok ? res.json().catch(() => null) : null;
}

async function loadData() {
    try {
        const [emp, proj, tsk] = await Promise.all([
            api('GET', '/api/employees'), api('GET', '/api/projects'), api('GET', '/api/tasks'),
        ]);
        employees = emp || []; projects = proj || []; tasks = tsk || [];
        updateSelects(); renderProjects(); renderEmployees(); renderTasks();
    } catch (e) { console.error('Ошибка при загрузке данных:', e); }
}

// --- МАСКИ ВВОДА ---
document.addEventListener('DOMContentLoaded', () => {
    $('newEmpTg').addEventListener('input', (e) => {
        // Оставляем только латиницу, цифры, @ и _
        let clean = e.target.value.replace(/[^a-zA-Z0-9_@]/g, '').toLowerCase();
        if (clean && !clean.startsWith('@')) clean = '@' + clean.replace(/@/g, '');
        e.target.value = clean;
    });

    $('newEmpPhone').addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (!val) { e.target.value = ''; return; }
        if (val.startsWith('8')) val = '7' + val.slice(1);
        if (!val.startsWith('7')) val = '7' + val;

        let formatted = '+7 ';
        if (val.length > 1) formatted += '(' + val.substring(1, 4);
        if (val.length > 4) formatted += ') ' + val.substring(4, 7);
        if (val.length > 7) formatted += '-' + val.substring(7, 9);
        if (val.length > 9) formatted += '-' + val.substring(9, 11);

        e.target.value = formatted;
    });
});

$('addEmpBtn').onclick = async () => {
    const name = $('newEmpName').value.trim();
    let tg = $('newEmpTg').value.trim(), phone = $('newEmpPhone').value.trim();
    if (!name) return alert('Введите имя сотрудника');
    if (tg === '@') tg = '';

    await api('POST', '/api/employees', { name, tg, phone });
    $('newEmpName').value = $('newEmpTg').value = $('newEmpPhone').value = '';
    loadData();
};

window.deleteEmployee = async (id) => {
    if (!confirm('Удалить сотрудника?')) return;
    await api('DELETE', '/api/employees/' + id); loadData();
};

function renderEmployees() {
    if (employees.length === 0) return $('employeeList').innerHTML = '<p class="empty">Список пуст</p>';
    $('employeeList').innerHTML = employees.map(e => {
        const empTasks = tasks.filter(t => t.assignee_name === e.name);
        const tasksHtml = empTasks.length === 0 ? '<p class="empty-mini">Задач пока нет</p>'
            : empTasks.map(t => `<div class="mini-task ${t.status === 'Выполнена' ? 'done' : ''}"><span>${t.title}</span><span class="mini-status">${t.status}</span></div>`).join('');
        return `<div class="employee-card">
            <div class="emp-info"><b>${e.name}</b><span>TG: ${e.tg || '—'}</span><span>Тел: ${e.phone || '—'}</span></div>
            <div class="emp-accordion" onclick="toggleEmpTasks(${e.id})"><span class="accordion-text">Задачи (${empTasks.length})</span><span class="arrow" id="arrow-${e.id}">▼</span></div>
            <div class="emp-tasks" id="tasks-${e.id}">${tasksHtml}</div>
            <button class="emp-delete" onclick="deleteEmployee(${e.id})">×</button></div>`;
    }).join('');
}

window.toggleEmpTasks = (id) => {
    const open = $('tasks-' + id).classList.toggle('show');
    $('arrow-' + id).innerText = open ? '▲' : '▼';
};

$('addProjectBtn').onclick = async () => {
    const name = $('newProjectName').value.trim();
    if (!name) return alert('Введите название проекта');
    await api('POST', '/api/projects', { name }); $('newProjectName').value = ''; loadData();
};

window.deleteProject = async (id) => {
    if (!confirm('Удалить проект?')) return;
    await api('DELETE', '/api/projects/' + id); loadData();
};

function renderProjects() {
    $('projectList').innerHTML = projects.map(p =>
        `<span class="project-tag">${p.name}<button onclick="deleteProject(${p.id})">×</button></span>`).join('');
}

function resetForm() {
    $('title').value = ''; $('desc').value = ''; $('date').value = '';
    $('status').value = 'Новая'; $('project').value = ''; $('assignee').value = '';
}

$('saveBtn').onclick = async () => {
    const title = $('title').value.trim();
    if (!title) return alert('Введите название задачи');
    const taskData = {
        title, description: $('desc').value, date: $('date').value, status: $('status').value,
        project_id: $('project').value || null, assignee_id: $('assignee').value || null, priority: $('priority').value,
    };
    if (editIndex === -1) await api('POST', '/api/tasks', taskData);
    else { await api('PUT', '/api/tasks/' + editIndex, taskData); editIndex = -1; $('saveBtn').innerText = 'Сохранить'; }
    resetForm(); loadData();
};

window.editTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    $('title').value = task.title; $('desc').value = task.description || ''; $('date').value = task.date || '';
    $('status').value = task.status; $('project').value = task.project_id || '';
    $('assignee').value = task.assignee_id || ''; $('priority').value = task.priority || 'Средний';
    editIndex = id; $('saveBtn').innerText = 'Обновить'; window.scrollTo(0, 0);
};

window.changeStatus = async (id, newStatus) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await api('PUT', '/api/tasks/' + id, {
        title: task.title, description: task.description, date: task.date, status: newStatus,
        project_id: task.project_id, assignee_id: task.assignee_id, priority: task.priority,
    });
    loadData();
};

window.deleteTask = async (id) => {
    if (!confirm('Удалить задачу?')) return;
    await api('DELETE', '/api/tasks/' + id); loadData();
};

function updateSelects() {
    $('project').innerHTML = '<option value="">— не выбран —</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    $('assignee').innerHTML = '<option value="">— не выбран —</option>' + employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}

function updateStats() {
    const total = tasks.length, done = tasks.filter(t => t.status === 'Выполнена').length,
          work = tasks.filter(t => t.status === 'В работе').length;
    $('statTotal').innerText = total; $('statDone').innerText = done;
    $('statWork').innerText = work; $('statNew').innerText = total - done;
}

function renderTasks() {
    const search = $('search').value.toLowerCase(), filter = $('filter').value;
    const hideDone = $('hideDoneCheckbox') ? $('hideDoneCheckbox').checked : false;
    const visible = tasks.filter(t => {
        const matchSearch = t.title.toLowerCase().includes(search);
        const matchFilter = filter === 'all' || t.status === filter;
        const matchHide = !hideDone || t.status !== 'Выполнена';
        return matchSearch && matchFilter && matchHide;
    });
    $('emptyMsg').style.display = visible.length ? 'none' : 'block';
    $('taskList').innerHTML = visible.map(t => `<div class="task">
        <h3>${t.title}</h3><p>${t.description || 'Без описания'}</p>
        <div class="meta">Проект: ${t.project_name || '—'} | Исполнитель: ${t.assignee_name || '—'} | Срок: ${t.date || '—'}</div>
        <div class="meta">Приоритет: <span class="priority-${t.priority}">${t.priority}</span> | Статус: <span class="status-${t.status}">${t.status}</span></div>
        <div class="task-actions">
            <button class="btn-edit" onclick="editTask(${t.id})">Ред.</button>
            ${t.status !== 'В работе' ? `<button class="btn-status" onclick="changeStatus(${t.id}, 'В работе')">В работу</button>` : ''}
            ${t.status !== 'Выполнена' ? `<button class="btn-status" onclick="changeStatus(${t.id}, 'Выполнена')">Готово</button>` : ''}
            <button class="btn-delete" onclick="deleteTask(${t.id})">Удал.</button>
        </div></div>`).join('');
    updateStats();
}

const modal = $('settingsModal'), themeBtn = $('themeBtn');
$('settingsBtn').onclick = () => modal.classList.add('show');
window.closeSettings = () => modal.classList.remove('show');
window.onclick = (e) => { if (e.target === modal) modal.classList.remove('show'); };

function applyWallpaper(type) {
    if (type === 'light') document.body.style.setProperty('background', '#f0f0f0', 'important');
    else if (type === 'dark') document.body.style.setProperty('background', '#1a1a1a', 'important');
    else document.body.style.setProperty('background', `url("/static/images/wallpapers/${type}.jpg") center/cover fixed no-repeat`, 'important');
}

function applyTheme(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    themeBtn.innerText = isDark ? '☀️ Светлая тема' : '🌙 Темная тема';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.querySelectorAll('.wallpaper-option').forEach(el => {
        el.style.opacity = isDark ? '0.4' : '1';
        el.style.pointerEvents = isDark ? 'none' : 'auto';
    });
    if (isDark) document.body.style.setProperty('background', '#1a1a1a', 'important');
    else applyWallpaper(localStorage.getItem('wallpaper') || 'bg1');
}

themeBtn.onclick = () => applyTheme(!document.body.classList.contains('dark-theme'));

window.setWallpaper = (type) => {
    if (document.body.classList.contains('dark-theme')) return;
    localStorage.setItem('wallpaper', type); applyWallpaper(type);
};

$('hideDoneCheckbox').onchange = () => {
    localStorage.setItem('hideDone', $('hideDoneCheckbox').checked); renderTasks();
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    $('search').oninput = renderTasks; $('filter').onchange = renderTasks; $('sort').onchange = renderTasks;
    applyTheme(localStorage.getItem('theme') === 'dark');
    $('hideDoneCheckbox').checked = localStorage.getItem('hideDone') === 'true';
    const isGrid = localStorage.getItem('gridView') !== 'false';
    $('gridViewCheckbox').checked = isGrid;
    $('taskList').classList.toggle('list-view', !isGrid);
    $('gridViewCheckbox').onchange = () => {
        const grid = $('gridViewCheckbox').checked;
        localStorage.setItem('gridView', grid);
        $('taskList').classList.toggle('list-view', !grid);
    };
});

window.copySupportNumber = () => {
    const phone = '+78001234567';
    navigator.clipboard.writeText(phone).then(() => {
        const btn = $('supportBtn'), originalText = btn.innerText;
        btn.innerText = 'Номер скопирован!'; btn.style.background = '#27ae60';
        setTimeout(() => { btn.innerText = originalText; btn.style.background = 'rgba(0,0,0,0.8)'; }, 2000);
    }).catch(() => alert('Не удалось скопировать номер: ' + phone));
};