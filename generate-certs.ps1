# Script tạo chứng chỉ SSL tự ký (Self-signed Certificate) cho Nginx
$opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
$certDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (!(Test-Path "$certDir\certs")) {
    New-Item -ItemType Directory -Path "$certDir\certs" -Force | Out-Null
}

$keyFile = "$certDir\certs\selfsigned.key"
$crtFile = "$certDir\certs\selfsigned.crt"

Write-Host "Đang tạo chứng chỉ SSL tự ký cho domain 'localhost'..." -ForegroundColor Cyan

if (Test-Path $opensslPath) {
    & $opensslPath req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $keyFile `
        -out $crtFile `
        -subj "/C=VN/ST=HoChiMinh/L=District1/O=ProjectManagementOrg/OU=IT/CN=localhost"
    Write-Host "Đã tạo thành công: $crtFile và $keyFile" -ForegroundColor Green
} else {
    Write-Warning "Không tìm thấy OpenSSL tại $opensslPath. Đang thử dùng OpenSSL trong hệ thống..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $keyFile -out $crtFile -subj "/C=VN/ST=HoChiMinh/L=District1/O=ProjectManagementOrg/OU=IT/CN=localhost"
}
