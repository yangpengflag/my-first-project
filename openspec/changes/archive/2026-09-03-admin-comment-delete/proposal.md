# admin-comment-delete — Proposal

## Why

当前系统**不存在 admin 角色**，评论删除只能由作者本人完成：

- 后端 `CommentService.delete` / `SpotCommentService.delete` 仅校验 `comment.userId == 当前用户`，非作者抛 `NOT_COMMENT_AUTHOR`——**没有任何管理员豁免**。
- 后端 `User` 实体只有 `email/password/status/...`，`status` 是用户状态（ACTIVE/LOCKED/...），**无 role/admin 字段**；`UserResponse` 出网白名单也无 `role`。
- 前端 `canDelete` 仅判断作者。

产品需要管理员有能力删除任意用户的违规评论（帖子评论 + 景点评论两套体系）。这必须**先引入 admin 角色体系**，再在删除鉴权处放开豁免——是跨前后端的改动，涉及实体字段、出网契约、DB schema。

## Scope

**后端**
- `auth/domain/Role.java`：新增 `enum Role { USER, ADMIN }`。
- `User.role` 字段：`@Enumerated(EnumType.STRING)`，`nullable = false`，`length = 16`，默认 `Role.USER`；`register(...)` 固定 `USER`；新增 `getRole()/setRole()`。DB 列由 `ddl-auto: update` 自动加（`role varchar(16) not null default 'USER'`）。
- `UserResponse`：白名单加 `role` 字段 + `from()` 映射 `user.getRole().name()`；同步把 `"role"` 加入 `WHITELISTED_FIELDS`（受 `UserResponseSerializationTest` 严格相等护栏约束）。
- `CommentService.delete` 与 `SpotCommentService.delete`：作者本人 **或** `Role.ADMIN` 可删，其余非作者 → `NOT_COMMENT_AUTHOR`。保留原有「作者本人顶层级联软删回复」逻辑。
- 开放契约 `frontend/openapi/openapi.json` 的 `UserResponse` 加 `role`（`"USER" | "ADMIN"`），重生成 `lib/api.generated.ts`。

**前端**
- `CommentThread` 把 `user?.role` 经 `currentUserRole` prop 下传给 `CommentItem`。
- `CommentItem`：`canDelete` 与回复行的 `replyCanDelete` 支持 `currentUserRole === "ADMIN"`（无论是否作者均可删）。

## Out of Scope

- 不新增「提升为 admin」的公开端点 / 注册入口（避免权限自提升）。
- 不做 admin 后台 UI / CMS。
- 不做角色相关的 Flyway / Liquibase 迁移脚本（`ddl-auto: update` 自动处理列）。
- 不改动帖子评论 / 景点评论的公开读写行为（仅删除鉴权放宽）。

## Impact

- 后端：`auth` 包新增 `Role`；`User` 增字段；`UserResponse` 增字段；`comments` / `places` 两个服务的 `delete` 增 admin 豁免。
- 前端：`CommentThread` / `CommentItem` 增 `currentUserRole` prop；`lib/api.generated.ts` 增 `UserRole` 与 `role?`。
- 安全降级：存量用户行若 `role` 为 NULL（首次加列、Hibernate 未回填时），`getRole() == null` → 判定非 admin，不会误放删除权。

## 已确认决策

- **admin 判定放在 service 内部按 `userId` 查 `User.role`**，不动 security 链（`JwtAuthFilter` 只把 userId 写进 `Authentication.getName()`，无 authorities）——最稳，不碰全局认证上下文。
- **角色仅由受信任管理通道（如 DB 直更 `setRole(ADMIN)`）提升**，注册流程与公开端点不暴露赋值入口，避免权限自提升。
- 用 `ddl-auto: update` 自动加列，**无迁移脚本**；首次部署到本地 MySQL 若报 NOT NULL 无默认值，需手动 `UPDATE users SET role='USER' WHERE role IS NULL;`（一次）。
- 前端 `role` 经 session（`authApi.me()` → `UserResponse`）可用，直接下传；admin 删除按钮仅做展示，真实裁决仍在后端（前端放行不改变服务端鉴权）。
