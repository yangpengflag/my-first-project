## Context

- `backend-conventions.md`（always-on 约束，SHOULD 级）明确规定：Response DTO **继承 `dto/response/BaseResponse`**（自带 `request_id`）、字段用 `@JsonProperty("snake_case")` 显式声明、immutable（`private final` + 构造器）、且存在 `RequestIdFilter` 每请求生成 UUID 写入 request attribute + MDC。
- 但当前 backend 与约束**多处偏离**：
  - `BaseResponse` 在全仓搜索为 **0**——该类根本不存在；
  - `UserResponse` / `PostResponse` / `PostSummary` / `AuthTokenResponse` / `ErrorResponse` 全是 **record、无基类、camelCase**；
  - 响应 JSON 为 camelCase（posts design D6、`UserResponse` 注释均写明 camelCase）；
  - `RequestIdFilter` / `requestId` / `MDC` 全仓搜索为 **0**——跨切关注点完全未落地。
- 上一轮 `align-soft-delete-to-db-conventions` 的 task 10.2 已将此议题标记为独立 concern。用户决策：**拆成独立第二个 change**，且 `snake_case + request_id + BaseResponse` 为**权威项**——强制改代码 + 重新生成 `frontend/openapi.json`。
- 当前无前端消费方（`frontend/lib/auth/client.ts` 已落地但首页未接入后端），故契约变更此刻成本最低；必须在 change 内重新生成 openapi 快照，使其保持权威。

## Goals / Non-Goals

**Goals:**

- 新增 `BaseResponse`（含 `request_id`），所有 Response DTO 继承之。
- 所有 Response DTO 字段转 `snake_case`（显式 `@JsonProperty`），保持 immutable。
- 新增 `RequestIdFilter`，每请求注入 `request_id`（request attribute + MDC），`BaseResponse` 构造时读取。
- 序列化白名单护栏（`WHITELISTED_FIELDS` + 序列化测试）同步 snake_case + `request_id`。
- 重新生成 `frontend/openapi/openapi.json`（含 `request_id`、snake_case 字段）。
- 同步更新 specs（`posts` / `auth-module` / `auth-frontend`）响应侧字段名为 snake_case，并将 `request_id` 写入信封描述；修正 `backend-conventions.md` 中过时的包布局描述（`entity/`/`dto/` → 实际 `domain/`/`api/`）。

**Non-Goals:**

- **不**把 Response DTO 搬进共享 `dto/` 包——保持按模块 `api/` 组织，仅 `BaseResponse` 共享于 `dto/response/`；包布局的规约描述改为贴合现实（doc fix，非代码搬家）。
- **不**改动 Request DTO（已是 record + Jakarta 校验，且规约要求请求侧 camelCase）。
- **不**重构 service→controller 的 DTO 构造职责（service 当前直接返回 Response DTO，本 change 不改变该分层选择）；`request_id` 通过 MDC 自动注入，避免污染所有 service 方法签名。

## Decisions

### D1. `BaseResponse` 抽象基类 + `request_id` 经 MDC 注入

新建 `com.mooc.backend.dto.response.BaseResponse`：

```java
public abstract class BaseResponse {
    @JsonProperty("request_id")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private final String requestId;

    protected BaseResponse() {
        this.requestId = MDC.get("requestId"); // 由 RequestIdFilter 注入
    }

    public String getRequestId() { return requestId; }
}
```

**理由**：当前 service 层直接构造并返回 Response DTO（`authService.register()` → `UserResponse`），规约字面要求"controller 取 requestId 构造 Response"会把 `requestId` 透传进每一个 service 方法签名，侵入面大且易遗漏。改为 `BaseResponse` 构造时从 `MDC` 读取 `request_id`，达到"每个响应都带 request_id"的契约意图，且对 service/controller 调用点零改动。**这是与规约字面表述的有意偏差，已记录于 Risks。**

### D2. `RequestIdFilter` 落地（满足跨切关注点）

新建 `com.mooc.backend.common.filter.RequestIdFilter`（`@Component` + `@Order(Ordered.HIGHEST_PRECEDENCE)` 或 `FilterRegistrationBean`），`doFilter` 内：

- 生成 `UUID.randomUUID().toString()`；
- `request.setAttribute("requestId", uuid)`；
- `MDC.put("requestId", uuid)`；
- `finally` 中 `MDC.remove("requestId")`（防线程复用串号）。

使规约"每请求生成 UUID → request attribute + MDC"真正落地，也为 D1 提供数据来源。

### D3. 5 个 Response DTO：record → class extends BaseResponse，snake_case

| 类 | 文件 | snake_case 字段（@JsonProperty） |
|---|---|---|
| `UserResponse` | `auth/api/UserResponse.java` | `id`, `email`, `display_name`, `avatar_url`, `status`, `created_at` |
| `AuthTokenResponse` | `auth/api/AuthTokenResponse.java` | `access_token`, `refresh_token`, `user` |
| `PostResponse` | `posts/api/PostResponse.java` | `id`, `title`, `content`, `cover_image_url`, `tags`, `status`, `author_id`, `author_name`, `author_avatar_url`, `summary`, `created_at`, `updated_at` |
| `PostSummary` | `posts/api/PostSummary.java` | `id`, `title`, `cover_image_url`, `tags`, `status`, `author_id`, `author_name`, `author_avatar_url`, `summary`, `created_at` |
| `ErrorResponse` | `auth/api/ErrorResponse.java` | 信封 `request_id` + `error{code,message,details}`（结构不变） |

实现要点：

- 全部改为 `public class Xxx extends BaseResponse`，字段 `private final` + 构造器赋值 + getter（`getId()` 等，供测试/前端使用）。
- `@JsonInclude(JsonInclude.Include.ALWAYS)` 保持（白名单护栏要求键集稳定）。
- `from(...)` 工厂方法**签名不变**（仍由 service 调用），`request_id` 经 `super()` 自动从 MDC 获取（见 D1）。
- `WHITELISTED_FIELDS` 改为 snake_case 集合并补 `"request_id"`。

### D4. 嵌套 `request_id` 冗余（已知权衡）

`AuthTokenResponse.user` 为 `UserResponse`（亦继承 `BaseResponse`），序列化后 `user` 内会带自己的 `request_id`，与顶层 `request_id` 重复。判定为**无害冗余**：前端读顶层 `request_id` 即可。备选（嵌套时不带 request_id）需给 `UserResponse` 特判，复杂度高 → **rejected**。

### D5. 序列化测试对齐

- `UserResponseSerializationTest` / `PostResponseSerializationTest`：record 访问器（`response.id()` → `getId()` 等）全部改为 getter；`WHITELISTED_FIELDS` 断言随 D3 更新。
- 测试 setup 中以 `MDC.put("requestId", "test-req")` 固定 `request_id`，保证键集断言稳定（避免无 Filter 时 `request_id` 为 null 的歧义）。
- 泄露护栏测试已同时覆盖 camelCase 与 snake_case 敏感键名（`password_hash`/`passwordHash` 等），白名单收窄后响应仍不含这些键，断言继续成立。

### D6. specs 响应侧同步（真相来源）

- `openspec/specs/posts/spec.md`：第 57/64/86/149 行响应字段名（`authorName`/`authorAvatarUrl`/`coverImageUrl`/`createdAt`/`updatedAt` 等）→ snake_case；白名单集合（149 行）改为 snake_case 列表 + 说明信封含 `request_id`。
- `openspec/specs/auth-module/spec.md`：第 180 行白名单 `{id, email, displayName, avatarUrl, status, createdAt}` → snake_case `{id, email, display_name, avatar_url, status, created_at}`；第 181 行"同时覆盖 snake_case 与 camelCase"说明保留（泄露护栏逻辑不变）；补充成功响应信封含 `request_id`。
- `openspec/specs/auth-frontend/spec.md`：仅改**响应侧**字段引用（如第 408 行白名单测试关联的响应键），**请求侧** `{email, password, displayName}` 保持 camelCase（规约要求请求侧 camelCase，不改）。

### D7. `backend-conventions.md` 过时包布局修正（doc fix）

- 第 10–19 行分层图 `entity/` + `dto/` 与真实代码（`domain/` + `api/`）不符——这是**规约本身过时**（auth、posts 两模块一致采用 `domain/`+`api/`，前端也已按此同步）。改为贴合现实的 `domain/` + `api/`，并注明 `BaseResponse` 共享于 `dto/response/`。
- 第 25/27/45 行关于 `BaseResponse`/`request_id`/`snake_case` 的要求**现在准确**，保留。
- 第 58 行 `RequestIdFilter` 原仅声明，现已在 D2 落地，补充其职责说明。

### D8. 重新生成 OpenAPI 快照

`frontend/openapi/openapi.json` 由 `npm run openapi:sync` 从运行中后端 `/v3/api-docs` 拉取（需 JDK 17 启动后端）。变更后所有响应字段变 snake_case 并增 `request_id`，必须重新生成以保权威。当前前端尚无消费方，但快照本身须正确。

## Risks / Trade-offs

- **[契约破坏]** snake_case + `request_id` 改变全部响应线格式。缓解：此刻无前端消费方；change 内强制重新生成 openapi 快照并核对。未来 `hot-posts` 等前端 change 将直接消费 snake_case 字段。
- **[与规约字面偏差]** 规约写"controller 取 requestId 构造 Response"，本 change 改为 `BaseResponse` 经 MDC 自动注入。理由见 D1（避免污染 service 签名、降低遗漏风险）。若评审要求严格字面，可改为逐层透传——但需扩大改动面，本 change 不采用。
- **[嵌套 request_id 冗余]** D4 已知权衡，无害。
- **[MDC null 噪声]** 测试无 Filter 时 `request_id` 可能为 null；D5 以 `MDC.put` 固定，规避。
- **[spec 漂移]** D6 需同步 3 个 spec；archive 时会 merge 进 `specs/`，确保真相一致。
- **[全局命名策略]** 确认项目未配置全局 snake_case 命名策略（当前 camelCase 靠默认），`@JsonProperty` 显式声明后不会双重转义。
