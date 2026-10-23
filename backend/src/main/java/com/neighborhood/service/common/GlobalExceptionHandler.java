package com.neighborhood.service.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
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

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        return Result.fail(ResultCode.PARAM_ERROR, "上传文件超过大小限制");
    }

    // ---------------- 兜底 ----------------
    @ExceptionHandler(Exception.class)
    public Result<Void> handleUnknown(Exception e, HttpServletRequest request) {
        // 未知异常必须打全堆栈，且不能把内部细节泄漏给前端
        log.error("未预期异常 {} {}", request.getMethod(), request.getRequestURI(), e);
        return Result.fail(ResultCode.SYSTEM_ERROR);
    }

    private static String formatFieldError(FieldError fe) {
        return fe.getDefaultMessage() == null || fe.getDefaultMessage().isBlank()
                ? fe.getField() + " 不合法"
                : fe.getDefaultMessage();
    }
}