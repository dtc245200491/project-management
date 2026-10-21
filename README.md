# HỆ THỐNG QUẢN LÝ DỰ ÁN (PROJECT MANAGEMENT SYSTEM) - ĐỀ BÀI SỐ 14

Dự án bài tập lớn / báo cáo thực hành môn **Triển khai và Quản trị Hệ thống Phần mềm**.

---

## 1. Giới thiệu tổng quan
Hệ thống quản lý dự án, tiến độ công việc (Kanban board) và nhân sự được đóng gói và vận hành tự động bằng Docker Compose, tích hợp đầy đủ các tiêu chuẩn DevOps công nghiệp:
- **Web App**: Node.js + Express.js + RESTful API + prom-client metrics + Structured JSON logging.
- **Frontend**: Giao diện Kanban kéo thả, quản lý dự án, danh sách nhân viên, KPI thống kê thời gian thực.
- **Database**: PostgreSQL 15 Alpine (mạng nội bộ cách ly) + pgAdmin4 web GUI.
- **Ingress Gateway**: Nginx Reverse Proxy (HTTPS TLS 1.2/1.3 tự ký + HTTP Security Headers: HSTS, CSP, X-Frame-Options).
- **Monitoring**: Prometheus v2.45 + cAdvisor v0.47 + Grafana 10 (auto-provisioned dashboard và datasources).
- **Centralized Logging**: Grafana Loki + Promtail + truy vấn LogQL.
- **Bảo mật Hardening**: Non-root user execution, Network Isolation (`backend-net` internal), Resource Limits (CPU/RAM).

---

## 2. Thông tin truy cập và tài khoản mặc định

| Dịch vụ | Địa chỉ URL | Tài khoản / Mật khẩu | Ghi chú |
|:---|:---|:---|:---|
| **Web App (Kanban)** | `https://localhost` | Không cần đăng nhập | Chạy qua HTTPS Nginx |
| **pgAdmin (GUI DB)** | `https://localhost/pgadmin/` | `admin@pm-system.local` / `PgAdmin_Sup3r_S3cur3#P@ssword2026!` | DB Host: `postgres-db`, Port: `5432`, DB: `planka_production` |
| **Grafana Dashboard** | `http://localhost:3000` | `admin` / `Gr@f@n@_M0n1t0r1ng_Str0ngP@ss!2026` | Đã tích hợp sẵn Dashboard & Datasources |
| **Prometheus Scraper** | `http://localhost:9090` | Không cần | Scrapes cAdvisor, Prometheus & Web App |
| **App Metrics** | `https://localhost/metrics` | Public | Prometheus Metrics format |

---

## 3. Hướng dẫn khởi chạy hệ thống

### Cách 1: Chạy bằng script tự động (Khuyến nghị)
Mở PowerShell tại thư mục dự án và chạy:
```powershell
.\start.ps1
```

### Cách 2: Chạy bằng lệnh Docker Compose thủ công
```bash
# 1. Sinh chứng chỉ SSL nếu chưa có
powershell -ExecutionPolicy Bypass -File .\generate-certs.ps1

# 2. Khởi chạy toàn bộ 9 container
docker compose up -d --build

# 3. Kiểm tra danh sách container
docker compose ps
```

### Dừng hệ thống:
```powershell
.\stop.ps1
# hoặc:
docker compose down
```

---

## 4. Cấu trúc thư mục

```text
project-management-system/
├── app/                              # Mã nguồn ứng dụng Web Quản lý Dự án
│   ├── db/init.js                    # Kết nối PostgreSQL, khởi tạo schema & seed data
│   ├── public/                       # Frontend (HTML5, Tailwind, JS, CSS)
│   ├── Dockerfile                    # Multi-stage/Hardened Alpine Dockerfile (Non-root user)
│   ├── package.json                  # Express, pg, prom-client, cors
│   └── server.js                     # Main Express server, API, Metrics, Healthcheck
├── certs/                            # Chứng chỉ SSL/TLS tự ký
│   ├── selfsigned.crt
│   └── selfsigned.key
├── nginx/conf.d/default.conf         # Cấu hình Reverse Proxy, HTTPS, Security Headers
├── prometheus/prometheus.yml         # Cấu hình scrape cAdvisor & App metrics
├── grafana/
│   ├── provisioning/                 # Tự động nạp Data Source (Prometheus + Loki) & Dashboards
│   └── dashboards/pm-dashboard.json  # File Dashboard mẫu
├── loki/loki-config.yml              # Cấu hình Grafana Loki
├── promtail/promtail-config.yml      # Cấu hình Promtail thu thập log container
├── .env                              # Biến môi trường bảo mật
├── docker-compose.yml                # File điều phối 9 container services
├── generate-certs.ps1                # Script tạo chứng chỉ SSL
├── start.ps1                         # Script kiểm tra Docker và khởi chạy 1 chạm
└── stop.ps1                          # Script dừng toàn bộ hệ thống
```
