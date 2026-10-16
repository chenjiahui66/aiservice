package com.neighborhood.service.service;

import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.entity.Complaint;
import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.enums.ComplaintStatus;
import com.neighborhood.service.enums.ComplaintType;
import com.neighborhood.service.mapper.ComplaintMapper;
import com.neighborhood.service.security.AuthPrincipal;
import com.neighborhood.service.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * 意见反馈（功能意见箱 / 投诉 / 违规举报）提交。
 *
 * <p>写入 {@code complaints} 表，与管理端 {@code GET /api/admin/complaints}、
 * {@code POST /api/admin/complaints/{id}/handle} 共用同一张表，
 * 因此管理后台无需任何改动即可看到并处理用户提交的内容。</p>
 *
 * <p><b>归属安全</b>：与预约接口同一原则——请求体中<b>没有 providerId</b>。
 * 服务者身份只来自登录 token（{@link AuthPrincipal#getProviderId()}），
 * 客户身份只来自推广码反查，客户端无法把反馈挂到任意服务者名下。</p>
 *
 * <p><b>不丢单</b>：无论推广码失效还是完全没有来源，都照常入库。
 * 归属解析不出来就留 {@code null} 表示平台级意见——一条产品建议的价值
 * 不取决于它由谁提出，丢掉的代价远大于「挂不上归属」。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ComplaintMapper complaintMapper;
    private final ReferralCodeService referralCodeService;

    @Transactional(rollbackFor = Exception.class)
    public PublicDto.FeedbackResultVO submit(PublicDto.FeedbackRequest request) {
        ComplaintType type = parseType(request.getType());
        Long providerId = resolveProviderId(request.getReferralCode());

        Complaint complaint = new Complaint();
        complaint.setType(type);
        complaint.setContent(request.getContent().trim());
        complaint.setCustomerName(trimToNull(request.getCustomerName()));
        complaint.setCustomerPhone(trimToNull(request.getCustomerPhone()));
        complaint.setProviderId(providerId);
        // 新提交一律进入待处理；处理结果只能由管理员通过 handle 接口写入
        complaint.setStatus(ComplaintStatus.PENDING);
        complaintMapper.insert(complaint);

        log.info("收到意见反馈 id={} type={} providerId={}", complaint.getId(), type.getCode(), providerId);

        PublicDto.FeedbackResultVO vo = new PublicDto.FeedbackResultVO();
        vo.setId(complaint.getId());
        vo.setStatus(ComplaintStatus.PENDING.getCode());
        vo.setStatusLabel(ComplaintStatus.PENDING.getLabel());
        vo.setCreatedAt(complaint.getCreatedAt() != null
                ? complaint.getCreatedAt().format(TS_FORMAT)
                : null);
        return vo;
    }

    // ------------------------------------------------------------------

    /**
     * 解析反馈类型。非法值统一翻译为 40000 参数错误，保持响应信封一致。
     */
    private ComplaintType parseType(String raw) {
        try {
            return ComplaintType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw BizException.of(ResultCode.PARAM_ERROR, "反馈类型不正确");
        }
    }

    /**
     * 解析反馈归属：登录服务者优先，其次用推广码反查客户所访问的服务者。
     *
     * <p>两者都没有时返回 {@code null}，表示<b>平台级意见</b>（例如「希望增加地图选点」
     * 这类与具体服务者无关的功能建议）。{@code complaints.provider_id} 已放开为可空，
     * 管理后台对空值显示「—」。</p>
     *
     * <p>推广码无效同样只留空继续入库：意见箱不该因为来源码失效而丢弃用户内容。</p>
     */
    private Long resolveProviderId(String referralCode) {
        AuthPrincipal principal = SecurityUtils.getPrincipal();
        if (principal != null && principal.getProviderId() != null) {
            return principal.getProviderId();
        }
        if (referralCode == null || referralCode.isBlank()) {
            return null;
        }
        ReferralCode code = referralCodeService.findByCode(referralCode.trim());
        return code == null ? null : code.getProviderId();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
