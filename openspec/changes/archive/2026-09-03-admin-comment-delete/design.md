# Design (admin-comment-delete)

## 总览架构

```
认证链（不动）
  JwtAuthFilter: Authentication.getName() = userId   ← 仅注入 userId，无 authorities

评论删除鉴权（放宽）
  CommentService.delete / SpotCommentService.delete
    ├─ 查 comment（不存在/已删 → COMMENT_NOT_FOUND）
    ├─ isAdmin = userRepository.findById(userId).map(u -> u.role == ADMIN).orElse(false)
    ├─ if (comment.userId != userId && !isAdmin) → NOT_COMMENT_AUTHOR
    └─ 软删（顶层 + 级联回复）  ← admin 走同一路径，无特殊分支

出网
  User.role ── UserResponse.from() ── WHITELISTED_FIELDS 含 "role" ──> me 接口 / 前端 session
  前端 CommentThread.user?.role ──currentUserRole──> CommentItem(canDelete 含 isAdmin)
```

## 后端

### Role 枚举与 User.role

`auth/domain/Role.java`：
```java
public enum Role { USER, ADMIN }
```

`User` 字段（`status` 列相邻，复用 `@Enumerated(STRING)` 套路）：
```java
@Enumerated(EnumType.STRING)
@Column(nullable = false, length = 16)
private Role role = Role.USER;
```
- `register(...)` 固定 `this.role = Role.USER`；新增 `getRole()` / `setRole()`。
- 文档约束：角色仅由受信任管理通道提升，注册流程不暴露。

**DB 列**：`ddl-auto: update` 在应用启动时自动 `ALTER TABLE users ADD role varchar(16) not null`；是否自动补默认值取决于 Hibernate 方言（H2 测试无存量行，无影响）。本地 MySQL 首次部署若因 NOT NULL 无默认值失败，需手动 `UPDATE users SET role='USER' WHERE role IS NULL;`（见风险 R1）。

### 出网白名单 UserResponse

`UserResponse` 新增：
- `@JsonProperty("role") String role` 字段与构造参数；
- `WHITELISTED_FIELDS` 加入 `"role"`（受 `UserResponseSerializationTest` 断言键集合严格相等的护栏约束）；
- `from(User)` 映射 `user.getRole() == null ? null : user.getRole().name()`。

### 删除鉴权豁免

`CommentService.delete` 与 `SpotCommentService.delete` 在作者判定前插入：
```java
boolean isAdmin = userRepository.findById(userId)
        .map(u -> u.getRole() == Role.ADMIN)
        .orElse(false);
if (!comment.getUserId().equals(userId) && !isAdmin) {
    throw new CommentException(ErrorCode.NOT_COMMENT_AUTHOR);
}
```
- 保留原有「顶层评论级联软删回复、回复（叶子）不级联」逻辑。
- admin 删除走**同一软删 + 级联路径**，无特权分支（与作者行为一致，仅鉴权放宽）。

### 开放契约

`frontend/openapi/openapi.json` 的 `UserResponse` schema 加：
```json
"role": { "type": "string", "enum": ["USER", "ADMIN"] }
```
经 `npm run openapi:gen` 重生成 `lib/api.generated.ts`（`UserRole` 类型 + `role?: UserRole`）。

## 前端

- `CommentThread`：`const { status, user } = useAuthSession();` 已有 `user`，渲染 `<CommentItem ... currentUserRole={user?.role} />`。
- `CommentItem` props 增 `currentUserRole?: string | null`：
  ```ts
  const isAdmin = currentUserRole === "ADMIN";
  const canDelete = !!currentUserId && (currentUserId === comment.user_id || isAdmin);
  ```
  回复行同理：`replyCanDelete = !!currentUserId && (currentUserId === r.user_id || isAdmin)`。
- **安全**：admin 删除按钮出现即代表后端已授权；后端是删除的唯一裁决方，前端仅做展示，按钮可见性不改变服务端鉴权（越权请求仍被 `NOT_COMMENT_AUTHOR` 拦下）。

## 设计注记（探索期锁定，A–D）

- **A** admin 判定在 service 内部查 `User.role`，不污染 `SecurityContext`（JwtAuthFilter 只注入 userId，无 authorities）。
- **B** 角色仅 DB 直更提升，注册 / 公开端点不暴露 setter 入口，避免权限自提升。
- **C** `ddl-auto: update` 自动加列，无迁移脚本；存量数据回填见风险 R1。
- **D** 前端 `role` 来自 session（me 接口），admin 删除按钮仅展示，真实裁决在后端。

## 风险

- **R1 存量列 NOT NULL 回填**：Hibernate `ddl-auto: update` 在 MySQL 8 下加 `not null` 列若无默认值，可能因存量行 `role IS NULL` 报错。缓解：首次部署到本地 MySQL 执行一次 `UPDATE users SET role='USER' WHERE role IS NULL;`（H2 测试与全新库无此问题）。已记入 memory。
- **R2 无 admin 自助提升**：admin 必须先经 DB 直更 `setRole(ADMIN)` 才具备删除能力——本 change 不提供 UI，符合最小权限原则（无后台则无法自助提权）。
- **R3 越权测试覆盖**：`deleteByAdminSucceedsEvenIfNotAuthor` 仅验证「非作者 admin 可删」；未覆盖「admin 删不存在评论 → COMMENT_NOT_FOUND」「普通用户删他人 → NOT_COMMENT_AUTHOR 不变」——后者由既有用例保障，前者已由 `orElseThrow` 链路覆盖，无需新增。
