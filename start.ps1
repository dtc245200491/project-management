# ==============================================================================
# SCRIPT KHỞI CHẠY HỆ THỐNG QUẢN LÝ DỰ ÁN (PROJECT MANAGEMENT SYSTEM - ĐỀ 14)
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  HỆ THỐNG QUẢN LÝ DỰ ÁN (PROJECT MANAGEMENT) - ĐỀ BÀI SỐ 14     " -ForegroundColor Yellow
Write-Host "  Khởi động hạ tầng Docker Compose, Nginx SSL, DB, Monitoring   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Kiểm tra chứng chỉ SSL
if (!(Test-Path "certs\selfsigned.crt") -or !(Test-Path "certs\selfsigned.key")) {
    Write-Host "[1/3] Chưa có chứng chỉ SSL. Đang tiến hành tạo mới..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\generate-certs.ps1
} else {
    Write-Host "[1/3] Chứng chỉ SSL đã sẵn sàng." -ForegroundColor Green
}

# 2. Kiểm tra Docker Daemon
Write-Host "[2/3] Kiểm tra trạng thái Docker Desktop..." -ForegroundColor Cyan
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Docker Daemon chưa chạy! Đang thử khởi động Docker Desktop..."
    $dockerDesktopPath = "C:\Users\Admin\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    if (Test-Path $dockerDesktopPath) {
        Start-Process $dockerDesktopPath
        Write-Host "Đang chờ Docker Desktop khởi động (khoảng 20-30 giây)..." -ForegroundColor Yellow
        $ready = $false
        for ($i = 1; $i -le 15; $i++) {
            Start-Sleep -Seconds 3
            docker info > $null 2>&1
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
                break
            }
            Write-Host "  Đang chờ Docker sẵn sàng ($($i*3)s)..." -ForegroundColor DarkGray
        }
        if (-not $ready) {
            Write-Error "Không thể kết nối tới Docker! Vui lòng bật Docker Desktop từ Start Menu và chạy lại script này."
            exit 1
        }
    } else {
        Write-Error "Không tìm thấy Docker Desktop. Vui lòng bật Docker và thử lại."
        exit 1
    }
}
Write-Host "Docker Daemon đang hoạt động tốt!" -ForegroundColor Green

# 3. Build và khởi chạy các containers
Write-Host "[3/3] Đang build ứng dụng Web và khởi chạy các services ngầm..." -ForegroundColor Cyan
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "  HỆ THỐNG ĐÃ KHỞI CHẠY THÀNH CÔNG!                              " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "  1. Ứng dụng Quản lý Dự án (HTTPS):  https://localhost" -ForegroundColor White
    Write-Host "  2. Quản trị CSDL pgAdmin (HTTPS):    https://localhost/pgadmin/" -ForegroundColor White
    Write-Host "     - Email:    admin@pm-system.local" -ForegroundColor DarkGray
    Write-Host "     - Mật khẩu: PgAdmin_Sup3r_S3cur3#P@ssword2026!" -ForegroundColor DarkGray
    Write-Host "     - Host DB:  postgres-db (Port 5432 nội bộ)" -ForegroundColor DarkGray
    Write-Host "  3. Bảng điều khiển Grafana:          http://localhost:3000" -ForegroundColor White
    Write-Host "     - User:     admin" -ForegroundColor DarkGray
    Write-Host "     - Mật khẩu: Gr@f@n@_M0n1t0r1ng_Str0ngP@ss!2026" -ForegroundColor DarkGray
    Write-Host "  4. Prometheus Metrics Server:        http://localhost:9090 (hoặc /metrics)" -ForegroundColor White
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "Xem trạng thái các container bằng lệnh: docker compose ps" -ForegroundColor Cyan
} else {
    Write-Error "Có lỗi xảy ra khi chạy docker compose up!"
}
