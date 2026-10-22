# ==============================================================================
# DOCKERFILE - PROJECT MANAGEMENT APPLICATION (NODE.JS + POSTGRESQL)
# Áp dụng Hardening: Alpine Linux, Non-root User, Không cài package thừa
# ==============================================================================
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Khởi tạo non-root user và group (UID 1000)
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy package descriptors trước để tận dụng Docker layer caching
COPY package*.json ./

# Cài đặt production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy toàn bộ mã nguồn ứng dụng
COPY . .

# Phân quyền thư mục cho non-root user
RUN chown -R appuser:appgroup /app

# Chuyển quyền thực thi sang non-root user
USER appuser

# Khai báo cổng ứng dụng
EXPOSE 1337

# Lệnh khởi chạy server
CMD ["node", "server.js"]
