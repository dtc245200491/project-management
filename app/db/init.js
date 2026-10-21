const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres-db',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'planka_admin',
  password: process.env.POSTGRES_PASSWORD || 'Pr0j3ct#M@n@g3m3nt_S3cur3_P@ss2026!',
  database: process.env.POSTGRES_DB || 'planka_production',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initDatabase(retries = 10, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[DB] Đang kết nối tới PostgreSQL (lần thử ${i}/${retries})...`);
      const client = await pool.connect();
      console.log('[DB] Kết nối PostgreSQL thành công!');

      // Khởi tạo bảng dữ liệu
      await client.query(`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          role VARCHAR(50) NOT NULL,
          avatar_color VARCHAR(20) DEFAULT '#3b82f6',
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          key VARCHAR(20) UNIQUE NOT NULL,
          description TEXT,
          status VARCHAR(30) DEFAULT 'Active',
          priority VARCHAR(20) DEFAULT 'Medium',
          deadline DATE,
          budget NUMERIC(12, 2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          status VARCHAR(30) DEFAULT 'todo',
          priority VARCHAR(20) DEFAULT 'medium',
          assigned_to INTEGER REFERENCES members(id) ON DELETE SET NULL,
          due_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Kiểm tra và chèn dữ liệu mẫu nếu bảng members đang rỗng
      const memberCount = await client.query('SELECT COUNT(*) FROM members');
      if (parseInt(memberCount.rows[0].count, 10) === 0) {
        console.log('[DB] Đang tạo dữ liệu mẫu cho hệ thống quản lý dự án...');
        
        // Chèn thành viên mẫu
        await client.query(`
          INSERT INTO members (name, email, role, avatar_color, status) VALUES
          ('Nguyễn Văn An', 'an.nguyen@pm.local', 'Project Manager', '#3b82f6', 'Active'),
          ('Trần Thị Bình', 'binh.tran@pm.local', 'Tech Lead', '#10b981', 'Active'),
          ('Lê Hoàng Cường', 'cuong.le@pm.local', 'DevOps Engineer', '#8b5cf6', 'Active'),
          ('Phạm Minh Dũng', 'dung.pham@pm.local', 'Full-stack Developer', '#f59e0b', 'Active'),
          ('Hoàng Thu Hà', 'ha.hoang@pm.local', 'QA / Tester', '#ec4899', 'Active')
        ;`);

        // Chèn dự án mẫu
        await client.query(`
          INSERT INTO projects (name, key, description, status, priority, deadline, budget) VALUES
          ('Hệ thống Quản lý Dự án (Đề 14)', 'PRJ-14', 'Triển khai hạ tầng DevOps: Nginx SSL, Docker Compose, PostgreSQL, pgAdmin, Prometheus, Grafana, Loki, Promtail và Hardening.', 'Active', 'High', '2026-11-30', 25000000),
          ('Cổng Thông tin Khách hàng Doanh nghiệp', 'CRM-01', 'Xây dựng module chăm sóc khách hàng, quản lý hợp đồng tự động và thanh toán trực tuyến.', 'Planning', 'Medium', '2026-12-15', 40000000),
          ('Nâng cấp Hạ tầng Microservices & CI/CD', 'INFRA-02', 'Chuyển đổi kiến trúc sang Kubernetes, thiết lập pipeline GitLab CI và bảo mật Container Registry.', 'Active', 'High', '2026-10-31', 35000000)
        ;`);

        // Chèn công việc mẫu (Tasks)
        await client.query(`
          INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date) VALUES
          (1, 'Cấu hình Nginx Reverse Proxy & SSL', 'Thiết lập file cấu hình nginx, tạo chứng chỉ tự ký HTTPS và thêm các Security Headers', 'done', 'high', 3, '2026-10-25'),
          (1, 'Phân vùng mạng Network Isolation cho PostgreSQL', 'Thiết lập mạng nội bộ backend-net với internal: true cho Database', 'done', 'urgent', 3, '2026-10-26'),
          (1, 'Dựng Dashboard Grafana giám sát CPU/RAM/Mạng', 'Tích hợp cAdvisor và Prometheus scrape metrics, dựng bảng theo dõi', 'in_progress', 'high', 2, '2026-10-28'),
          (1, 'Thiết lập thu thập Log tập trung Promtail + Loki', 'Chuyển Docker container logs về Loki và kiểm tra bằng LogQL', 'in_progress', 'medium', 3, '2026-10-29'),
          (1, 'Kiểm thử phân quyền Non-root và Giới hạn tài nguyên', 'Đảm bảo containers chạy với UID non-root và giới hạn memory/cpu limit', 'todo', 'high', 1, '2026-10-30'),
          (2, 'Thiết kế Mockup giao diện CRM khách hàng', 'Dựng wireframe và prototype Figma cho module quản lý ticket', 'in_progress', 'medium', 4, '2026-11-05'),
          (2, 'Viết API xác thực người dùng JWT', 'Xây dựng API đăng nhập, cấp refresh token và phân quyền RBAC', 'todo', 'medium', 4, '2026-11-10'),
          (3, 'Tối ưu Dockerfile đa tầng (Multi-stage build)', 'Giảm dung lượng image production dưới 150MB', 'review', 'medium', 3, '2026-10-28')
        ;`);

        // Ghi log hoạt động ban đầu
        await client.query(`
          INSERT INTO activity_logs (action, details) VALUES
          ('SYSTEM_INIT', 'Khởi tạo thành công cơ sở dữ liệu hệ thống quản lý dự án (Đề bài 14)'),
          ('SECURITY_CHECK', 'Hệ thống áp dụng chính sách phân vùng mạng và bảo mật mật khẩu')
        ;`);

        console.log('[DB] Dữ liệu mẫu đã được tạo thành công!');
      }

      client.release();
      return pool;
    } catch (err) {
      console.error(`[DB] Lỗi kết nối (thử lại sau ${delay / 1000}s): ${err.message}`);
      if (i === retries) throw err;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

module.exports = { pool, initDatabase };
