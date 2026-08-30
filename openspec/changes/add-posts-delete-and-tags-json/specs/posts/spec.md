## Purpose

为已登录用户提供旅行攻略（Story）的创作、编辑、删除与消费能力：草稿 / 发布、公开列表与详情、以及"我的帖子"视图，作者展示信息复用既有 `User` 身份。

## ADDED Requirements

### Requirement: 删除帖子（仅作者，软删除）

`DELETE /api/posts/{id}` SHALL 软删除指定帖子（行保留，`deleted` 置 `true`），仅作者本人可执行。未携带 / 无效令牌 SHALL 返回 `401 UNAUTHENTICATED`；令牌有效但非作者 SHALL 返回 `403 NOT_POST_AUTHOR`；帖子不存在或已软删 SHALL 返回 `404 POST_NOT_FOUND`；成功 SHALL 返回 `204 No Content`。软删后该帖子从所有公开 / 私有列表与详情中消失（查询层 `findByXxxAndDeletedFalse` 过滤）。系统 SHALL NOT 对帖子做物理删除。

#### Scenario: 作者删除成功并从详情消失

- **WHEN** 作者携带令牌调用 `DELETE /api/posts/{已发布帖子id}`
- **THEN** 返回 `204 No Content`，随后 `GET /api/posts/{id}` 返回 `404 POST_NOT_FOUND`

#### Scenario: 他人删除被拒

- **WHEN** 用户 B 携带令牌调用 `DELETE /api/posts/{作者为 A 的帖子id}`
- **THEN** 返回 `403 Forbidden`，`error.code` 为 `"NOT_POST_AUTHOR"`

#### Scenario: 未鉴权删除被拒

- **WHEN** 未携带 `Authorization` 调用 `DELETE /api/posts/{id}`
- **THEN** 返回 `401 Unauthorized`，`error.code` 为 `"UNAUTHENTICATED"`
