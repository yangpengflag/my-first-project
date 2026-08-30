## Why

`posts` capability 当前缺少删除能力：作者无法撤回已发布 / 草稿攻略，违反"用户应能管理自己内容"的基本预期。同时 `tags` 当前使用 `@ElementCollection` + 关联表 `post_tags` 存储，与指令要求的 JSON 列不符；关联表在查询与维护上不如原生 JSON 列简洁。本 change 补上 `DELETE /api/posts/{id}`（软删除、仅作者本人、JWT 鉴权），并将 `tags` 改为单 JSON 列存储。

## What Changes

- 新增 `DELETE /api/posts/{id}`：软删除（行保留，`deleted=true`），仅作者本人可操作；未鉴权 `401`、非作者 `403`、不存在 `404`、成功 `204`。
- `Post.tags` 由 `@ElementCollection` + `post_tags` 关联表改为单 JSON 列（`@JdbcTypeCode(SqlTypes.JSON)`，`tags` 列）；对外仍是 `List<String>` 的 JSON 数组，序列化契约不变。
- 不引入物理删除；软删除仍由查询层 `findByXxxAndDeletedFalse` 自动排除（与现行 `posts` spec 一致）。

无 BREAKING 变更（`tags` 对外仍是 JSON 数组；仅新增端点，不影响既有端点契约）。

## Capabilities

### New Capabilities

- 无（沿用既有 `posts` capability）。

### Modified Capabilities

- `posts`：新增删除能力；`tags` 存储由关联表改为 JSON 列。

## Impact

- 数据表：`posts` 新增 `tags` JSON 列；`post_tags` 关联表不再使用（H2 测试库重建后自然消失，文件库需手动删除 `data/wanderchina*` 重建）。
- 后端包 `com.mooc.backend.posts`：controller / service / domain 小幅改动。
- API 契约（`/v3/api-docs`）新增 DELETE 路径，需重新生成前端 `openapi.json` 进仓快照并跑 `openapi:drift` 校验。
- 鉴权：DELETE 与既有写操作一致——`SecurityConfig.anyRequest().authenticated()` 兜底 `401`，controller 内 `currentUserId()` 推导作者并校验。
