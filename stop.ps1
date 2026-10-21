# Script dừng toàn bộ hệ thống
Write-Host "Đang dừng các containers của Hệ thống Quản lý Dự án..." -ForegroundColor Yellow
docker compose down
Write-Host "Đã dừng và giải phóng tài nguyên thành công." -ForegroundColor Green
