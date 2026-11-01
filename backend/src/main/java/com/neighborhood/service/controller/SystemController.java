package com.neighborhood.service.controller;

import com.neighborhood.service.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 版本自检接口。
 *
 * <p>为什么需要：线上「改了功能但没生效」最常见的原因不是代码错，而是
 * <b>jar 没换 / 容器没重建</b>（{@code docker compose up -d} 不带 {@code --build}
 * 时跑的还是旧镜像）。而这种情况从日志里看不出来，日志照样是「启动成功」。</p>
 *
 * <p>所以这里暴露一个带<b>构建时间</b>的接口：部署完 curl 一下，
 * 拿到的 buildTime 和本地刚打的包对一下，一眼就知道服务器上跑的是哪一版。</p>
 *
 * <p>无需登录：这是纯运维自检接口，不含任何业务数据。</p>
 */
@Tag(name = "05-版本自检", description = "返回当前运行的构建时间，用于确认线上跑的是不是最新版")
@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {

    private final ObjectProvider<BuildProperties> buildProperties;

    @Operation(summary = "版本自检",
            description = "返回 jar 的构建时间、版本号与启动时间。部署后先 curl 这个接口确认版本。")
    @GetMapping("/version")
    public Result<Map<String, Object>> version() {
        Map<String, Object> vo = new LinkedHashMap<>();
        BuildProperties props = buildProperties.getIfAvailable();
        vo.put("buildTime", props == null ? null : props.getTime().toString());
        vo.put("version", props == null ? null : props.getVersion());
        vo.put("artifact", props == null ? null : props.getArtifact());
        vo.put("startedAt", LocalDateTime.now().toString());
        // 明确告诉调用方：拿不到构建时间说明这个 jar 不是用带 build-info 的 pom 打的
        vo.put("buildInfoAvailable", props != null);
        return Result.ok(vo);
    }
}
