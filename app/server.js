const express = require('express');
const cors = require('cors');
const path = require('path');
const client = require('prom-client');
const { pool, initDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 1337;

// ==============================================================================
// 1. CẤU HÌNH PROMETHEUS METRICS
// ==============================================================================
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'pm_sys_' });

// Custom Business Metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Thời lượng xử lý các HTTP requests (giây)',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số lượt yêu cầu HTTP đã tiếp nhận',
  labelNames: ['method', 'route', 'code'],
});
register.registerMetric(httpRequestsTotal);

const totalProjectsGauge = new client.Gauge({
  name: 'pm_projects_total',
  help: 'Tổng số dự án hiện có trong hệ thống',
});
register.registerMetric(totalProjectsGauge);

const totalTasksGauge = new client.Gauge({
  name: 'pm_tasks_total',
  help: 'Tổng số công việc phân loại theo trạng thái',
  labelNames: ['status'],
});
register.registerMetric(totalTasksGauge);

// ==============================================================================
// 2. MIDDLEWARES & STRUCTURED LOGGING
// ==============================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Structured JSON Logger Middleware cho Promtail / Loki
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'pm_app',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
      client_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'] || 'unknown',
    };

    // Xuất log dạng JSON ra stdout để Promtail thu thập
    if (res.statusCode >= 500) {
      console.error(JSON.stringify({ level: 'error', ...logData }));
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify({ level: 'warn', ...logData }));
    } else {
      console.log(JSON.stringify({ level: 'info', ...logData }));
    }

    // Cập nhật Metrics
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route, code: res.statusCode });
    httpRequestDurationMicroseconds.observe(
      { method: req.method, route, code: res.statusCode },
      duration / 1000
    );
  });
  next();
});

// Phục vụ giao diện tĩnh (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Cập nhật giá trị Business Metrics định kỳ
async function updateBusinessMetrics() {
  try {
    const prjRes = await pool.query('SELECT COUNT(*) FROM projects');
    totalProjectsGauge.set(parseInt(prjRes.rows[0].count, 10));

    const taskRes = await pool.query(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    );
    const statuses = ['todo', 'in_progress', 'review', 'done'];
    statuses.forEach((st) => totalTasksGauge.set({ status: st }, 0));
    taskRes.rows.forEach((r) => {
      totalTasksGauge.set({ status: r.status }, parseInt(r.count, 10));
    });
  } catch (err) {
    // DB chưa sẵn sàng, bỏ qua lần cập nhật
  }
}
setInterval(updateBusinessMetrics, 10000);

// ==============================================================================
// 3. MONITORING & HEALTH CHECK ENDPOINTS
// ==============================================================================

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    await updateBusinessMetrics();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Health check endpoint (Dùng cho Docker Compose Healthcheck)
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT 1');
    res.json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbCheck.rowCount === 1 ? 'CONNECTED' : 'DISCONNECTED',
      memory: process.memoryUsage(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      error: err.message,
    });
  }
});

// ==============================================================================
// 4. RESTFUL API CHO QUẢN LÝ DỰ ÁN, CÔNG VIỆC VÀ THÀNH VIÊN
// ==============================================================================

// Thống kê tổng hợp (Summary Stats)
app.get('/api/stats', async (req, res) => {
  try {
    const [projects, tasks, members, completedTasks] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query('SELECT COUNT(*) FROM members WHERE status = $1', ['Active']),
      pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['done']),
    ]);

    const totalT = parseInt(tasks.rows[0].count, 10);
    const doneT = parseInt(completedTasks.rows[0].count, 10);
    const completionRate = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;

    res.json({
      totalProjects: parseInt(projects.rows[0].count, 10),
      totalTasks: totalT,
      activeMembers: parseInt(members.rows[0].count, 10),
      completedTasks: doneT,
      completionRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API DỰ ÁN (PROJECTS) ---
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, key, description, status, priority, deadline, budget } = req.body;
    if (!name || !key) {
      return res.status(400).json({ error: 'Tên và Mã Dự án (Key) là bắt buộc' });
    }
    const result = await pool.query(
      `INSERT INTO projects (name, key, description, status, priority, deadline, budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, key.toUpperCase(), description || '', status || 'Active', priority || 'Medium', deadline || null, budget || 0]
    );
    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'PROJECT_CREATE',
      `Tạo dự án mới: [${result.rows[0].key}] ${result.rows[0].name}`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    if (deleted.rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy dự án' });
    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'PROJECT_DELETE',
      `Xóa dự án: ${deleted.rows[0].name}`,
    ]);
    res.json({ message: 'Đã xóa dự án thành công', project: deleted.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API THÀNH VIÊN (MEMBERS) ---
app.get('/api/members', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM members ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Họ tên và email là bắt buộc' });
    }
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const result = await pool.query(
      `INSERT INTO members (name, email, role, avatar_color, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, role || 'Developer', randomColor, status || 'Active']
    );
    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'MEMBER_ADD',
      `Thêm thành viên mới: ${name} (${role})`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API CÔNG VIỆC / TASKS (KANBAN) ---
app.get('/api/tasks', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = `
      SELECT t.*, 
        m.name as assignee_name, 
        m.avatar_color as assignee_color,
        p.name as project_name,
        p.key as project_key
      FROM tasks t
      LEFT JOIN members m ON t.assigned_to = m.id
      LEFT JOIN projects p ON t.project_id = p.id
    `;
    const params = [];
    if (project_id) {
      query += ' WHERE t.project_id = $1';
      params.push(project_id);
    }
    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { project_id, title, description, status, priority, assigned_to, due_date } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Tiêu đề công việc là bắt buộc' });
    }
    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_id || null, title, description || '', status || 'todo', priority || 'medium', assigned_to || null, due_date || null]
    );
    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'TASK_CREATE',
      `Tạo công việc mới: ${title}`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật trạng thái Task (Kéo thả Kanban column)
app.patch('/api/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Trạng thái mới là bắt buộc' });

    const result = await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy công việc' });

    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'TASK_STATUS_CHANGE',
      `Chuyển trạng thái task [${result.rows[0].title}] sang [${status}]`,
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    await pool.query('INSERT INTO activity_logs (action, details) VALUES ($1, $2)', [
      'TASK_DELETE',
      `Xóa công việc: ${result.rows[0].title}`,
    ]);
    res.json({ message: 'Xóa thành công', task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Nhật ký hoạt động (Audit Logs)
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Điều hướng trang đơn (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================================
// 5. KHỞI CHẠY SERVER VÀ KẾT NỐI DATABASE
// ==============================================================================
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`================================================================`);
      console.log(`[SERVER] 🚀 Project Management App đang chạy tại cổng ${PORT}`);
      console.log(`[SERVER] 📊 Prometheus metrics: http://0.0.0.0:${PORT}/metrics`);
      console.log(`[SERVER] 💓 Healthcheck endpoint: http://0.0.0.0:${PORT}/api/health`);
      console.log(`================================================================`);
    });
  } catch (err) {
    console.error('[SERVER] Lỗi nghiêm trọng khi khởi động:', err);
    process.exit(1);
  }
}

startServer();
