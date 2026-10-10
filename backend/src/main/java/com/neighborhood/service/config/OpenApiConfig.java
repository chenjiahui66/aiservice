package com.neighborhood.service.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI(Swagger) 文档配置，访问 /doc.html。 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI neighborhoodOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("邻里服务管家 API")
                        .version("1.0.0")
                        .description("""
                                多服务者上门服务管理系统后端接口。

                                **响应约定**：业务失败统一返回 HTTP 200，由 body 中的 `code` 表达结果；
                                `code = 0` 表示成功。仅未认证(401)/无权限(403)使用对应 HTTP 状态码，body 结构一致。

                                **安全约定**：服务者端所有数据接口均以 token 中的 providerId 作为数据隔离过滤条件，
                                服务端不接受前端传入的 providerId 作为归属依据。
                                """)
                        .contact(new Contact().name("邻里服务管家")))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}