# ---------- 构建阶段 ----------
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

# 先只拷 pom 走依赖层缓存：源码改动不会触发重新下载依赖
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ---------- 运行阶段 ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 以非 root 运行
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /build/target/neighborhood-backend.jar ./app.jar
RUN mkdir -p /data/qr /data/logs && chown -R app:app /data /app

USER app

ENV TZ=Asia/Shanghai \
    SPRING_PROFILES_ACTIVE=prod \
    QR_DIR=/data/qr \
    LOG_FILE=/data/logs/neighborhood-backend.log

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/v3/api-docs >/dev/null 2>&1 || exit 1

ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-jar", "/app/app.jar"]