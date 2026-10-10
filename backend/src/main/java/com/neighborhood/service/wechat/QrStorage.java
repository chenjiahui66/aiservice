package com.neighborhood.service.wechat;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 二维码图片的本地文件存储。
 *
 * <p><b>设计要点</b>：数据库只存 {@code imageKey}（相对文件名），
 * 二进制绝不进库。真实生产环境应把 {@code qrDir} 挂载为对象存储/OSS 桶，
 * 届时只需替换本类实现，数据库结构无需改动。</p>
 */
@Slf4j
@Component
public class QrStorage {

    @Getter
    private final Path rootDir;

    public QrStorage(@Value("${app.storage.qr-dir:./data/qr}") String qrDir) {
        this.rootDir = Paths.get(qrDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootDir);
            log.info("二维码存储目录: {}", this.rootDir);
        } catch (IOException e) {
            log.error("二维码存储目录创建失败: {}", this.rootDir, e);
            throw new IllegalStateException("二维码存储目录不可用: " + this.rootDir, e);
        }
    }

    /** 保存图片，返回 storage key（文件名）。 */
    public String save(String key, byte[] image) {
        // 防御 key 路径穿越
        String safeKey = Paths.get(key).getFileName().toString();
        Path target = resolveDir().resolve(safeKey);
        try {
            Files.write(target, image);
            return safeKey;
        } catch (IOException e) {
            log.error("保存二维码失败: {}", target, e);
            throw new IllegalStateException("保存二维码失败", e);
        }
    }

    public byte[] read(String key) throws IOException {
        String safeKey = Paths.get(key).getFileName().toString();
        Path target = resolveDir().resolve(safeKey);
        if (!Files.exists(target)) {
            return null;
        }
        return Files.readAllBytes(target);
    }

    public Path resolveDir() {
        return rootDir;
    }

    public boolean exists(String key) {
        return Files.exists(rootDir.resolve(Paths.get(key).getFileName().toString()));
    }
}