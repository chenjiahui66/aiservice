package com.neighborhood.service.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/**
 * 全局异常处理。
 *
 * <p><b>响应约定</b>：业务失败统一 HTTP 200 + 业务错误码（便于小程序端/后台端
 * 统一在一处拦截处理）；仅「未认证/无权限」由 Spring Security 过滤器链返回 401/403，
 * body 结构与此处保持一致。</p>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ---------------- 业务异常 ----------------
    @ExceptionHandler(BizException.class)
    public Result<Void> handleBiz(BizException e, HttpServletRequest request) {
        log.warn("业务异常 [{}] {} -> code={} msg={}",
                request.getMethod(), request.getRequestURI(), e.getCode(), e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    // ---------------- 参数校验 ----------------
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleInvalidBody(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(GlobalExceptionHandler::formatFieldError)
                .collect(Collectors.joining("；"));
        return Result.fail(ResultCode.PARAM_ERROR, msg.isEmpty() ? ResultCode.PARAM_ERROR.getMessage() : msg);
    }

    @ExceptionHandler(BindException.class)
    public Result<Void> handleBind(BindException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(GlobalExceptionHandler::formatFieldError)
                .collect(Collectors.joining("；"));
        return Result.fail(ResultCode.PARAM_ERROR, msg.isEmpty() ? ResultCode.PARAM_ERROR.getMessage() : msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraint(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.joining("；"));
        return Result.fail(ResultCode.PARAM_ERROR, msg);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.fail(ResultCode.PARAM_ERROR, "缺少必要参数：" + e.getParameterName());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public Result<Void> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return Result.fail(ResultCode.PARAM_ERROR, "参数格式不正确：" + e.getName());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        // 光一句「请求体格式不正确」用户完全不知道该改哪里。
        // Jackson 的原始信息里带着「是哪个字段、收到的值是什么、期望什么格式」，
        // 而且这些值本来就是他自己提交上来的，透出对定位有帮助。
        // 只在确实是 Jackson 的映射错误时透出，别的一律走通用文案，避免泄漏内部细节。
        Throwable cause = e.getMostSpecificCause();
        if (cause instanceof com.fasterxml.jackson.databind.JsonMappingException jme
                && jme.getOriginalMessage() != null) {
            return Result.fail(ResultCode.PARAM_ERROR, jme.getOriginalMessage());
        }
        return Result.fail(ResultCode.PARAM_ERROR, "请求体格式不正确");
    }

    // ---------------- 权限 ----------------
    @ExceptionHandler(AccessDeniedException.class)
    public Result<Void> handleAccessDenied(AccessDeniedException e) {
        log.warn("越权访问被拒绝: {}", e.getMessage());
        return Result.fail(ResultCode.FORBIDDEN);
    }

    @ExceptionHandler(AuthenticationException.class)
    public Result<Void> handleAuth(AuthenticationException e) {
        return Result.fail(ResultCode.UNAUTHORIZED);
    }

    // ---------------- HTTP 语义 ----------------
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public Result<Void> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return Result.fail(40500, "请求方法不支持：" + e.getMethod());
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public Result<Void> handleNoHandler(NoHandlerFoundException e) {
        return Result.fail(ResultCode.NOT_FOUND);
    }

    /**
     * 路径没有对应的接口。
     *
     * <p>Spring 6 找不到处理器时会交给静态资源处理器，它抛
     * {@link NoResourceFoundException}。这个异常以前落到兜底分支，
     * 被报成「系统繁忙，请稍后重试」（50000）——<b>404 报成 500 是彻头彻尾的误导</b>：
     * 现场会去查数据库、查数据、查部署，唯独不会想到「这个 jar 里压根没这个接口」。
     * 本项目就因此绕了远路：以为接口存在、以为 jar 是新的，其实服务器跑的是旧包。</p>
     *
     * <p>这里必须单独接住，返回 40400，让前端一眼看出是「接口不存在」
     * （通常是 jar 没更新）而不是「服务端出错」。</p>
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public Result<Void> handleNoResource(NoResourceFoundException e) {
        log.warn("接口不存在: {} {}", e.getResourcePath(), e.getHttpMethod());
        return Result.fail(ResultCode.NOT_FOUND);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        return Result.fail(ResultCode.PARAM_ERROR, "上传文件超过大小限制");
    }

    // ---------------- 数据库 ----------------

    /**
     * 数据库访问失败。
     *
     * <p>线上最常见的一类故障：代码更新了、数据库表结构没跟上（schema.sql 只在
     * 数据卷首次初始化时执行一次，存量环境补不上），于是
     * {@code SELECT} 直接报 {@code Unknown column 'xxx'}。</p>
     *
     * <p>以前这里落到兜底分支，前端只看到「系统繁忙，请稍后重试」，
     * 完全看不出是缺列还是缺表。把 SQL 错误里最关键的一句提炼出来回给前端，
     * 现场一眼就能判断该补什么。</p>
     */
    @ExceptionHandler(DataAccessException.class)
    public Result<Void> handleDb(DataAccessException e, HttpServletRequest request) {
        log.error("数据库访问失败 {} {}", request.getMethod(), request.getRequestURI(), e);
        return Result.fail(50001, "数据库访问失败：" + describeSqlProblem(e));
    }

    /**
     * 从 JDBC 异常里提炼出「缺哪张表 / 缺哪列 / 重复键」这类能直接照着修的信息。
     *
     * <p>只回传数据库自己说的那一句，不带连接串、表前缀等内部信息。</p>
     */
    private String describeSqlProblem(DataAccessException e) {
        Throwable cause = e.getMostSpecificCause();
        String msg = cause == null ? null : cause.getMessage();
        if (msg == null) {
            return "请检查后端日志";
        }
        // Unknown column 'xxx' in 'field list' → 缺少字段 xxx
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("Unknown column '([^']+)'").matcher(msg);
        if (m.find()) {
            return "数据表缺少字段 " + m.group(1) + "，请执行数据库迁移（bash deploy/migrate.sh）";
        }
        // Table 'db.xxx' doesn't exist → 缺少表 xxx
        m = java.util.regex.Pattern
                .compile("Table '[^']+\\.([^']+)' doesn't exist").matcher(msg);
        if (m.find()) {
            return "数据表 " + m.group(1) + " 不存在，请执行数据库迁移（bash deploy/migrate.sh）";
        }
        if (msg.contains("Duplicate entry")) {
            return "存在重复数据";
        }
        return "请查看后端日志";
    }

    // ---------------- 兜底 ----------------
    @ExceptionHandler(Exception.class)
    public Result<Void> handleUnknown(Exception e, HttpServletRequest request) {
        // 未知异常必须打全堆栈，且不能把内部细节泄漏给前端。
        //
        // ⚠️ 但这一行日志必须**自带病因**：只打 URI 的话，现场拿到日志后
        //    还得翻堆栈最上面几行才知道是什么错，而 stack trace 动不动几十行，
        //    一旦被 tail/head 截断，恰好截掉的就是异常类型和抛出点 —— 这正是
        //    「线上只看到 50000，查不出原因」最常见的原因。
        //    所以这里在日志首行就带上「异常全限定名 + 我方代码的抛出点」，
        //    一条 grep 就能定位到具体是哪一行出的问题。
        log.error("未预期异常 {} {} -> {} @ {}", request.getMethod(), request.getRequestURI(),
                e.getClass().getName(), topFrame(e), e);
        return Result.fail(ResultCode.SYSTEM_ERROR);
    }

    /**
     * 找出最靠近异常源的「我方代码」栈帧，形如
     * {@code com.neighborhood.service.service.ServiceItemService.listManageView(ServiceItemService.java:237)}。
     *
     * <p>优先挑本项目自己的类：JDK 内部帧（反射、JDBC 驱动）只会干扰判断，
     * 真正的出错点通常在本项目的第一帧。</p>
     */
    private static String topFrame(Throwable e) {
        StackTraceElement[] frames = e.getStackTrace();
        for (StackTraceElement f : frames) {
            if (f.getClassName().startsWith("com.neighborhood.service")) {
                return f.toString();
            }
        }
        return frames.length == 0 ? "未知位置" : frames[0].toString();
    }

    private static String formatFieldError(FieldError fe) {
        return fe.getDefaultMessage() == null || fe.getDefaultMessage().isBlank()
                ? fe.getField() + " 不合法"
                : fe.getDefaultMessage();
    }
}