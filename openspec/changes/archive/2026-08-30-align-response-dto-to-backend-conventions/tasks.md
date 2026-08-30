# Tasks — align-response-dto-to-backend-conventions

> 遵循 spec-driven TDD：每个代码改动先写/改失败测试（RED），再改实现使其通过（GREEN），最后核对无回归（REFACTOR）。
> 所有后端改动落在 `backend/` 子仓；spec/规约改动落在仓库根 `openspec/` 与 `.codebuddy/rules/`；openapi 快照落在 `frontend/` 子仓。
> 契约破坏性变更，须在本 change 内重新生成 `frontend/openapi.json`。

## 1. 新增 BaseResponse 基类

- [ ] 1.1 新建 `backend/src/main/java/com/mooc/backend/dto/response/BaseResponse.java`：
  - `public abstract class BaseResponse`
  - `@JsonProperty("request_id") @JsonInclude(JsonInclude.Include.ALWAYS) private final String requestId;`
  - 保护构造器 `protected BaseResponse() { this.requestId = MDC.get("requestId"); }`
  - `public String getRequestId()`
  - import `org.slf4j.MDC`、`com.fasterxml.jackson.annotation.*`

## 2. 新增 RequestIdFilter

- [ ] 2.1 新建 `backend/src/main/java/com/mooc/backend/common/filter/RequestIdFilter.java`：
  - `@Component` + `@Order(Ordered.HIGHEST_PRECEDENCE)`（或 `FilterRegistrationBean`），实现 `Filter`。
  - `doFilter`：`String rid = UUID.randomUUID().toString();` → `request.setAttribute("requestId", rid); MDC.put("requestId", rid);` → `chain.doFilter` → `finally { MDC.remove("requestId"); }`。
  - import `java.util.UUID`、`org.slf4j.MDC`、`jakarta.servlet.*`、`org.springframework.core.Ordered`。

## 3. 转换 UserResponse（auth）

- [ ] 3.1 `auth/api/UserResponse.java`：record → `public class UserResponse extends BaseResponse`；字段 `private final` + snake_case `@JsonProperty`（`id`,`email`,`display_name`,`avatar_url`,`status`,`created_at`）+ getter。
- [ ] 3.2 构造器调用 `super()`（request_id 经 MDC 注入）；`from(User)` 签名不变，内部 `new UserResponse(id, email, ...)`。
- [ ] 3.3 `WHITELISTED_FIELDS` → `Set.of("id","email","display_name","avatar_url","status","created_at","request_id")`；类注释 camelCase 表述改 snake_case。

## 4. 转换 AuthTokenResponse（auth）

- [ ] 4.1 `auth/api/AuthTokenResponse.java`：record → `public class AuthTokenResponse extends BaseResponse`；字段 `access_token`,`refresh_token`,`user`（类型 `UserResponse`）+ getter；构造器 `super()`。

## 5. 转换 PostResponse + PostSummary（posts）

- [ ] 5.1 `posts/api/PostResponse.java`：record → `public class PostResponse extends BaseResponse`；snake_case 字段（`id`,`title`,`content`,`cover_image_url`,`tags`,`status`,`author_id`,`author_name`,`author_avatar_url`,`summary`,`created_at`,`updated_at`）+ getter；构造器 `super()`；`from(...)` 签名不变。
- [ ] 5.2 `WHITELISTED_FIELDS` → snake_case + `request_id`；类注释 camelCase 表述改 snake_case。
- [ ] 5.3 `posts/api/PostSummary.java`：同 5.1 模式（字段 `id`,`title`,`cover_image_url`,`tags`,`status`,`author_id`,`author_name`,`author_avatar_url`,`summary`,`created_at`）；`WHITELISTED_FIELDS` 同步。

## 6. 转换 ErrorResponse（auth）

- [ ] 6.1 `auth/api/ErrorResponse.java`：record → `public class ErrorResponse extends BaseResponse`；保留 `error` 字段（`ErrorBody` 可仍为嵌套 record）；构造器 `super()`；`of(...)` 静态工厂返回新类实例。
- [ ] 6.2 信封结构不变：`{"request_id":..., "error":{"code","message","details"}}`。

## 7. 序列化测试对齐（TDD：先 RED 后 GREEN）

- [ ] 7.1 `auth/api/UserResponseSerializationTest.java`：
  - `response.id()` → `getId()`、`response.email()` → `getEmail()`、`response.displayName()` → `getDisplayName()`、`response.status()` → `getStatus()`、`response.createdAt()` → `getCreatedAt()`。
  - 类或方法 setup `MDC.put("requestId", "test-req-id")`；`@AfterEach MDC.clear()`。
  - `WHITELISTED_FIELDS` 断言随 3.3 自动生效（键集含 snake_case + request_id）。
- [ ] 7.2 `posts/api/PostResponseSerializationTest.java`：
  - 同 7.1 模式：`PostResponse.from(...)` / `PostSummary` 测试若用访问器改 getter；setup 固定 `MDC`。
  - 泄露断言 `doesNotContain("deleted_at").doesNotContain("deletedAt").doesNotContain("\"email\"")` 仍成立。
- [ ] 7.3 运行 `mvn test` 定位其余 record 访问器调用点（`AuthFlowIntegrationTest`、`AuthService*Test`、`PostServiceTest`、`PostsControllerIntegrationTest`、`OpenApiDocsTest` 等），将 `.id()`/`.email()`/`.title()` 等改为对应 getter，直至全量编译通过。

## 8. 重新生成 OpenAPI 快照（契约变更必须）

- [ ] 8.1 以 JDK 17（`D:\Programs\java17`）启动 backend（`mvn spring-boot:run`，确保 8080 空闲）。
- [ ] 8.2 在 `frontend/` 运行 `npm run openapi:sync`，从 `/v3/api-docs` 重写 `frontend/openapi/openapi.json`。
- [ ] 8.3 校验快照：含 `/api/posts`、`/api/auth`；响应 schema 字段为 snake_case 且含 `request_id`；停止 backend 释放端口与 H2 文件锁，清理临时日志。

## 9. 同步 specs（真相来源）

- [ ] 9.1 `openspec/specs/posts/spec.md`：第 57/64/86/149 行响应字段名 camelCase → snake_case；第 149 行白名单集合改 snake_case 列表并注明信封含 `request_id`。
- [ ] 9.2 `openspec/specs/auth-module/spec.md`：第 180 行白名单 `{id, email, displayName, avatarUrl, status, createdAt}` → `{id, email, display_name, avatar_url, status, created_at}`；第 181 行"同时覆盖 snake_case 与 camelCase"泄露护栏说明保留；补充成功响应信封含 `request_id`。
- [ ] 9.3 `openspec/specs/auth-frontend/spec.md`：仅改响应侧字段引用（如第 408 行白名单测试关联的响应键）为 snake_case；**请求侧** `{email, password, displayName}` 保持 camelCase。

## 10. 修正 backend-conventions.md（doc fix）

- [ ] 10.1 `.codebuddy/rules/backend-conventions.md`：第 10–19 行分层图 `entity/`+`dto/` → 实际 `domain/`+`api/`，注明 `BaseResponse` 共享于 `dto/response/`；第 58 行 `RequestIdFilter` 补充"已在 `common/filter/RequestIdFilter.java` 落地"说明。
- [ ] 10.2 第 25/27/45 行 `BaseResponse`/`request_id`/`snake_case` 要求现准确，保留。

## 11. 验证与交付

- [ ] 11.1 `backend/` 运行 `mvn test` 全量绿灯；确认无 `BaseResponse` 缺失、无 record 访问器残留。
- [ ] 11.2 核对 `frontend/openapi/openapi.json` 契约字段为 snake_case 且含 `request_id`（task 8 产物）。
- [ ] 11.3 三仓分别提交：`backend/`（Java 改动）、`frontend/`（openapi 快照）、父仓（更新 frontend submodule 指针 + openspec 归档）。提交前确认 `.codebuddy/rules/` 与 `openspec/specs/` 改动一并进父仓。
