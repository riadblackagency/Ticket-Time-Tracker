const STORAGE_KEY = 'ticket-time-tracker';
const elements = {
  form: document.getElementById('task-form'),
  input: document.getElementById('task-name'),
  list: document.getElementById('task-list'),
  empty: document.getElementById('empty-state'),
  template: document.getElementById('task-template'),
  summaryTotal: document.getElementById('summary-total'),
  summaryRunning: document.getElementById('summary-running'),
  clearAll: document.getElementById('clear-all'),
};

let tasks = loadTasks();
let ticker = null;

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load tasks', err);
    return [];
  }
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderTasks() {
  elements.list.innerHTML = '';

  if (tasks.length === 0) {
    elements.empty.style.display = 'block';
  } else {
    elements.empty.style.display = 'none';
  }

  tasks
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((task) => {
      const node = elements.template.content.cloneNode(true);
      const article = node.querySelector('article');
      article.dataset.taskId = task.id;
      node.querySelector('.task-title').textContent = task.name;
      node.querySelector('.task-meta').textContent = `Gestartet: ${formatDate(
        task.createdAt
      )}`;

      const timeDisplay = node.querySelector('[data-task-time]');
      timeDisplay.textContent = formatDuration(getElapsed(task));

      const toggleBtn = node.querySelector('[data-action="toggle"]');
      toggleBtn.textContent = task.running ? '❚❚' : '▶';
      toggleBtn.setAttribute(
        'aria-label',
        task.running ? 'Timer pausieren' : 'Timer starten'
      );

      node.querySelector('[data-action="reset"]').addEventListener('click', () =>
        resetTask(task.id)
      );
      node
        .querySelector('[data-action="delete"]')
        .addEventListener('click', () => deleteTask(task.id));
      toggleBtn.addEventListener('click', () => toggleTask(task.id));

      const entries = node.querySelector('[data-entries]');
      if (task.entries.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Noch keine Zeitblöcke erfasst.';
        p.className = 'muted';
        entries.appendChild(p);
      } else {
        task.entries
          .slice()
          .reverse()
          .forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'entry-row';
            row.innerHTML = `<span>${formatDate(entry.start)} → ${formatDate(
              entry.end
            )}</span><strong>${formatDuration(entry.duration)}</strong>`;
            entries.appendChild(row);
          });
      }

      elements.list.appendChild(node);
    });

  updateSummary();
}

function getElapsed(task) {
  const active = task.running && task.lastStart ? Date.now() - task.lastStart : 0;
  return task.elapsed + active;
}

function addTask(name) {
  const newTask = {
    id: crypto.randomUUID(),
    name: name.trim(),
    elapsed: 0,
    running: false,
    lastStart: null,
    createdAt: Date.now(),
    entries: [],
  };
  tasks.push(newTask);
  persistTasks();
  renderTasks();
}

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    if (task.running) {
      return stopTask(task);
    }
    return startTask(task);
  });
  persistTasks();
  startTicker();
  renderTasks();
}

function startTask(task) {
  return { ...task, running: true, lastStart: Date.now() };
}

function stopTask(task) {
  if (!task.running || !task.lastStart) return { ...task, running: false };
  const duration = Date.now() - task.lastStart;
  return {
    ...task,
    running: false,
    lastStart: null,
    elapsed: task.elapsed + duration,
    entries: [...task.entries, { start: task.lastStart, end: Date.now(), duration }],
  };
}

function resetTask(id) {
  tasks = tasks.map((task) =>
    task.id === id
      ? { ...task, elapsed: 0, running: false, lastStart: null, entries: [] }
      : task
  );
  persistTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  persistTasks();
  renderTasks();
}

function updateSummary() {
  const total = tasks.reduce((sum, task) => sum + getElapsed(task), 0);
  const runningCount = tasks.filter((task) => task.running).length;
  elements.summaryTotal.textContent = formatDuration(total);
  elements.summaryRunning.textContent = `${runningCount} aktive Timer`;
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    if (tasks.some((task) => task.running)) {
      renderTasks();
    } else {
      stopTicker();
    }
  }, 1000);
}

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

function wireEvents() {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = elements.input.value.trim();
    if (!name) return;
    addTask(name);
    elements.input.value = '';
    elements.input.focus();
  });

  elements.clearAll.addEventListener('click', () => {
    if (tasks.length === 0) return;
    if (confirm('Alle Aufgaben löschen?')) {
      tasks = [];
      persistTasks();
      renderTasks();
    }
  });
}

wireEvents();
renderTasks();
startTicker();
