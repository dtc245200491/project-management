// Global State
let projectsData = [];
let membersData = [];
let tasksData = [];

// Helper: priority badge colors
const priorityColors = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Thấp' },
  medium: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Vừa' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Cao' },
  urgent: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Khẩn cấp' },
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  checkHealth();
  setInterval(checkHealth, 15000);
});

async function loadAllData() {
  await Promise.all([
    loadStats(),
    loadProjects(),
    loadMembers(),
    loadTasks(),
  ]);
}

// -----------------------------------------------------------------------------
// 1. STATS & HEALTH CHECK
// -----------------------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stat-projects').innerText = data.totalProjects || 0;
    document.getElementById('stat-tasks').innerText = data.totalTasks || 0;
    document.getElementById('stat-rate').innerText = `${data.completionRate || 0}%`;
    document.getElementById('stat-members').innerText = data.activeMembers || 0;
  } catch (err) {
    console.error('Lỗi khi nạp thống kê:', err);
  }
}

async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const badge = document.getElementById('system-health-badge');
    const text = document.getElementById('health-text');
    if (res.ok) {
      const data = await res.json();
      text.innerText = `PostgreSQL: ${data.database}`;
      badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
    } else {
      text.innerText = 'Database: Disconnected';
      badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200';
    }
  } catch (err) {
    const text = document.getElementById('health-text');
    if (text) text.innerText = 'API Offline';
  }
}

// -----------------------------------------------------------------------------
// 2. PROJECTS MANAGEMENT
// -----------------------------------------------------------------------------
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    projectsData = await res.json();

    // Cập nhật dropdowns
    const filterSelect = document.getElementById('filter-project');
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Tất cả dự án</option>';
    
    const taskSelect = document.getElementById('task-project');
    taskSelect.innerHTML = '<option value="">-- Chọn dự án --</option>';

    projectsData.forEach(p => {
      filterSelect.innerHTML += `<option value="${p.id}" ${currentFilter == p.id ? 'selected' : ''}>[${p.key}] ${p.name}</option>`;
      taskSelect.innerHTML += `<option value="${p.id}">[${p.key}] ${p.name}</option>`;
    });

    // Render Cards in Projects View
    const container = document.getElementById('projects-container');
    container.innerHTML = '';
    projectsData.forEach(p => {
      const totalT = parseInt(p.total_tasks, 10) || 0;
      const doneT = parseInt(p.completed_tasks, 10) || 0;
      const progress = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
      
      const deadlineStr = p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : 'Chưa đặt';
      const budgetStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.budget || 0);

      container.innerHTML += `
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">${p.key}</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">${p.status}</span>
            </div>
            <h3 class="font-bold text-sm text-slate-900 leading-snug mb-1">${escapeHtml(p.name)}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 mb-4">${escapeHtml(p.description || 'Không có mô tả')}</p>
          </div>

          <div class="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div>
              <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Tiến độ (${doneT}/${totalT} tasks)</span>
                <span>${progress}%</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-1.5">
                <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${progress}%"></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span><i class="fa-regular fa-calendar mr-1"></i>${deadlineStr}</span>
              <span class="font-semibold text-slate-700">${budgetStr}</span>
            </div>

            <div class="flex justify-end pt-2">
              <button onclick="deleteProject(${p.id})" class="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1">
                <i class="fa-solid fa-trash-can"></i> Xóa dự án
              </button>
            </div>
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error('Lỗi khi nạp danh sách dự án:', err);
  }
}

// -----------------------------------------------------------------------------
// 3. MEMBERS MANAGEMENT
// -----------------------------------------------------------------------------
async function loadMembers() {
  try {
    const res = await fetch('/api/members');
    membersData = await res.json();

    const taskAssignee = document.getElementById('task-assignee');
    taskAssignee.innerHTML = '<option value="">-- Chưa chỉ định --</option>';

    const container = document.getElementById('members-container');
    container.innerHTML = '';

    membersData.forEach(m => {
      taskAssignee.innerHTML += `<option value="${m.id}">${escapeHtml(m.name)} (${m.role})</option>`;

      container.innerHTML += `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style="background-color: ${m.avatar_color || '#3b82f6'}">
            ${getInitials(m.name)}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-xs text-slate-900 truncate">${escapeHtml(m.name)}</h4>
            <p class="text-[11px] font-medium text-indigo-600 truncate">${escapeHtml(m.role)}</p>
            <p class="text-[11px] text-slate-400 truncate">${escapeHtml(m.email)}</p>
          </div>
          <span class="w-2.5 h-2.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}" title="${m.status}"></span>
        </div>
      `;
    });
  } catch (err) {
    console.error('Lỗi khi nạp thành viên:', err);
  }
}

// -----------------------------------------------------------------------------
// 4. TASKS & KANBAN MANAGEMENT
// -----------------------------------------------------------------------------
async function loadTasks() {
  try {
    const filterPrj = document.getElementById('filter-project').value;
    const url = filterPrj ? `/api/tasks?project_id=${filterPrj}` : '/api/tasks';
    const res = await fetch(url);
    tasksData = await res.json();

    const cols = {
      todo: document.getElementById('tasks-todo'),
      in_progress: document.getElementById('tasks-in_progress'),
      review: document.getElementById('tasks-review'),
      done: document.getElementById('tasks-done'),
    };

    const counts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    Object.values(cols).forEach(col => col.innerHTML = '');

    tasksData.forEach(t => {
      const col = cols[t.status] || cols.todo;
      counts[t.status] = (counts[t.status] || 0) + 1;

      const prio = priorityColors[t.priority] || priorityColors.medium;
      const dueStr = t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'Không hạn';

      const card = document.createElement('div');
      card.className = 'task-card bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2.5';
      card.setAttribute('draggable', 'true');
      card.dataset.id = t.id;

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">${t.project_key || 'TASK'}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded ${prio.bg} ${prio.text}">${prio.label}</span>
        </div>
        <div>
          <h5 class="text-xs font-bold text-slate-900 leading-snug">${escapeHtml(t.title)}</h5>
          ${t.description ? `<p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${escapeHtml(t.description)}</p>` : ''}
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
          <div class="flex items-center gap-1.5">
            ${t.assignee_name ? `
              <div class="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style="background-color: ${t.assignee_color || '#3b82f6'}">
                ${getInitials(t.assignee_name)}
              </div>
              <span class="text-slate-600 font-medium text-[11px] truncate max-w-[80px]">${escapeHtml(t.assignee_name)}</span>
            ` : '<span class="text-slate-400 italic">Chưa giao</span>'}
          </div>
          <span class="text-slate-400 text-[10px]"><i class="fa-regular fa-clock mr-1"></i>${dueStr}</span>
        </div>
        <div class="flex items-center justify-between pt-1">
          <select onchange="updateTaskStatus(${t.id}, this.value)" class="text-[10px] font-semibold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:outline-none">
            <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>Chuyển: Todo</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>Chuyển: In Progress</option>
            <option value="review" ${t.status === 'review' ? 'selected' : ''}>Chuyển: Review</option>
            <option value="done" ${t.status === 'done' ? 'selected' : ''}>Chuyển: Done</option>
          </select>
          <button onclick="deleteTask(${t.id})" class="text-slate-400 hover:text-rose-500 text-xs px-1" title="Xóa task">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      col.appendChild(card);
    });

    // Update count labels
    document.getElementById('count-todo').innerText = counts.todo || 0;
    document.getElementById('count-in_progress').innerText = counts.in_progress || 0;
    document.getElementById('count-review').innerText = counts.review || 0;
    document.getElementById('count-done').innerText = counts.done || 0;

  } catch (err) {
    console.error('Lỗi khi nạp danh sách công việc:', err);
  }
}

// -----------------------------------------------------------------------------
// 5. ACTIVITY LOGS (AUDIT TRAIL)
// -----------------------------------------------------------------------------
async function loadActivityLogs() {
  try {
    const res = await fetch('/api/logs');
    const logs = await res.json();
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = '';
    logs.forEach(l => {
      const timeStr = new Date(l.created_at).toLocaleString('vi-VN');
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-2.5 text-slate-500 whitespace-nowrap">${timeStr}</td>
          <td class="px-4 py-2.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">${l.action}</span>
          </td>
          <td class="px-4 py-2.5 text-slate-700">${escapeHtml(l.details)}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error('Lỗi khi nạp activity logs:', err);
  }
}

// -----------------------------------------------------------------------------
// 6. FORM SUBMISSIONS
// -----------------------------------------------------------------------------
async function handleCreateTask(e) {
  e.preventDefault();
  const task = {
    title: document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-desc').value.trim(),
    project_id: document.getElementById('task-project').value || null,
    assigned_to: document.getElementById('task-assignee').value || null,
    status: document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    due_date: document.getElementById('task-due').value || null,
  };

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (res.ok) {
      closeModal('modal-task');
      document.getElementById('form-task').reset();
      await loadAllData();
    }
  } catch (err) {
    alert('Lỗi tạo task: ' + err.message);
  }
}

async function handleCreateProject(e) {
  e.preventDefault();
  const prj = {
    name: document.getElementById('project-name').value.trim(),
    key: document.getElementById('project-key').value.trim(),
    description: document.getElementById('project-desc').value.trim(),
    status: document.getElementById('project-status').value,
    priority: document.getElementById('project-priority').value,
    deadline: document.getElementById('project-deadline').value || null,
    budget: parseFloat(document.getElementById('project-budget').value) || 0,
  };

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prj),
    });
    if (res.ok) {
      closeModal('modal-project');
      document.getElementById('form-project').reset();
      await loadAllData();
    }
  } catch (err) {
    alert('Lỗi tạo dự án: ' + err.message);
  }
}

async function handleCreateMember(e) {
  e.preventDefault();
  const member = {
    name: document.getElementById('member-name').value.trim(),
    email: document.getElementById('member-email').value.trim(),
    role: document.getElementById('member-role').value,
  };

  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });
    if (res.ok) {
      closeModal('modal-member');
      document.getElementById('form-member').reset();
      await loadAllData();
    }
  } catch (err) {
    alert('Lỗi thêm thành viên: ' + err.message);
  }
}

async function updateTaskStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      await loadAllData();
    }
  } catch (err) {
    console.error('Lỗi cập nhật status:', err);
  }
}

async function deleteTask(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa công việc này?')) return;
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadAllData();
  } catch (err) {
    alert('Lỗi xóa task: ' + err.message);
  }
}

async function deleteProject(id) {
  if (!confirm('Cảnh báo: Xóa dự án sẽ xóa toàn bộ công việc liên quan! Bạn có muốn tiếp tục?')) return;
  try {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    await loadAllData();
  } catch (err) {
    alert('Lỗi xóa dự án: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// 7. UI TABS & MODALS HELPERS
// -----------------------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
    el.classList.add('border-transparent', 'text-slate-500');
  });

  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) activeContent.classList.remove('hidden');

  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'border-indigo-600', 'text-indigo-600');
    activeBtn.classList.remove('border-transparent', 'text-slate-500');
  }

  if (tabId === 'activity') loadActivityLogs();
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('flex');
    m.classList.add('hidden');
  }
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
