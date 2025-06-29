let startTime = null;
let currentProject = null;
let currentTask = null;
let timerInterval = null;

async function initialize() {
  const { projects = [], tasks = [], projectMeta = {}, data = {}, currentTimer } = await chrome.storage.local.get(
    ['projects','tasks','projectMeta','data','currentTimer']
  );
  const projectSelect = document.getElementById('projectSelect');
  const taskSelect = document.getElementById('taskSelect');
  projects.forEach(p => projectSelect.add(new Option(p,p)));
  tasks.forEach(t => taskSelect.add(new Option(t,t)));
  if (currentTimer && currentTimer.startTime) {
    currentProject = currentTimer.project;
    currentTask = currentTimer.task;
    startTime = currentTimer.startTime;
    startTimerInterval();
  }
  updateSummary();
}

async function saveList(key, list) {
  await chrome.storage.local.set({ [key]: list });
}

document.getElementById('addProjectBtn').onclick = async () => {
  const name = document.getElementById('newProjectInput').value.trim();
  const runtime = parseInt(document.getElementById('newProjectRuntimeInput').value) || 0;
  const boxes = parseInt(document.getElementById('newProjectBoxesInput').value) || 0;
  if (!name) return alert('Project name required.');
  const { projects = [], projectMeta = {} } = await chrome.storage.local.get(['projects','projectMeta']);
  if (!projects.includes(name)) {
    projects.push(name);
    await saveList('projects', projects);
    document.getElementById('projectSelect').add(new Option(name,name));
  }
  projectMeta[name] = { runtime, boxes };
  await chrome.storage.local.set({ projectMeta });
  document.getElementById('newProjectInput').value = '';
  document.getElementById('newProjectRuntimeInput').value = '';
  document.getElementById('newProjectBoxesInput').value = '';
};

document.getElementById('addTaskBtn').onclick = async () => {
  const val = document.getElementById('newTaskInput').value.trim();
  if (!val) return;
  const { tasks = [] } = await chrome.storage.local.get('tasks');
  if (!tasks.includes(val)) {
    tasks.push(val);
    await saveList('tasks', tasks);
    document.getElementById('taskSelect').add(new Option(val,val));
  }
  document.getElementById('newTaskInput').value = '';
};

document.getElementById('startBtn').onclick = async () => {
  const proj = document.getElementById('projectSelect').value;
  const task = document.getElementById('taskSelect').value;
  if (!proj || !task) return alert('Select project and task.');
  if (startTime) await saveSession(currentProject, currentTask, startTime, Date.now());
  currentProject = proj;
  currentTask = task;
  startTime = Date.now();
  await chrome.storage.local.set({ currentTimer: { project: proj, task: task, startTime } });
  startTimerInterval();
};

document.getElementById('stopBtn').onclick = async () => {
  if (!startTime) return;
  await saveSession(currentProject, currentTask, startTime, Date.now());
  startTime = null;
  clearInterval(timerInterval);
  document.getElementById('timerDisplay').textContent = '00:00:00';
  await chrome.storage.local.remove('currentTimer');
};

document.getElementById('exportBtn').onclick = async () => {
  const { data = {}, projectMeta = {} } = await chrome.storage.local.get(['data','projectMeta']);
  let csv = 'Project,Runtime(min),Boxes,Task,Start,End,Duration(h)\n';
  for (const proj in data) {
    const meta = projectMeta[proj] || { runtime:0, boxes:0 };
    for (const task in data[proj]) {
      for (const s of data[proj][task]) {
        const startISO = new Date(s.start).toISOString();
        const endISO   = new Date(s.end).toISOString();
        const durH     = ((s.end - s.start)/3600000).toFixed(2);
        csv += [proj, meta.runtime, meta.boxes, task, startISO, endISO, durH].join(',') + '\n';
      }
    }
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'task_log.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

async function saveSession(project, task, start, end) {
  const { data = {} } = await chrome.storage.local.get('data');
  data[project] = data[project] || {};
  data[project][task] = data[project][task] || [];
  data[project][task].push({ start, end });
  await chrome.storage.local.set({ data });
  updateSummary();
}

function startTimerInterval() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    document.getElementById('timerDisplay').textContent = formatTime(Date.now() - startTime);
  }, 500);
}

function formatTime(ms) {
  const total = Math.floor(ms/1000);
  const h = String(Math.floor(total/3600)).padStart(2,'0');
  const m = String(Math.floor((total%3600)/60)).padStart(2,'0');
  const s = String(total%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

async function updateSummary() {
  const { data = {}, projectMeta = {} } = await chrome.storage.local.get(['data','projectMeta']);
  const projectsArray = Object.keys(data).map(proj => {
    let last = 0;
    Object.values(data[proj]).flat().forEach(s => { if (s.end>last) last = s.end; });
    return { proj, last };
  });
  projectsArray.sort((a,b) => b.last - a.last);
  const recent = projectsArray.slice(0,2).map(o => o.proj);
  let summary = '';
  recent.forEach(proj => {
    const meta = projectMeta[proj] || { runtime:0, boxes:0 };
    summary += `<b>${proj}</b> (Runtime: ${meta.runtime}m, Boxes: ${meta.boxes})<br>`;
    let total = 0;
    for (const task in data[proj]) {
      const tTime = data[proj][task].reduce((sum,s) => sum + (s.end - s.start), 0);
      summary += `&nbsp;&nbsp;- ${task}: ${(tTime/3600000).toFixed(2)}h<br>`;
      total += tTime;
    }
    summary += `Total: ${(total/3600000).toFixed(2)}h<br><br>`;
  });
  document.getElementById('summaryOutput').innerHTML = summary;
}

initialize();