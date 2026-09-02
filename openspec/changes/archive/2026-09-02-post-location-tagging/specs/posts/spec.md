# posts Specification (Delta — post-location-tagging)

## MODIFIED Requirements

### Requirement: 公开帖子列表（含作者展示信息与互动统计）

`GET /api/posts` SHALL 返回 PUBLISHED 帖子分页列表，结果项（`PostSummary`）SHALL 包含 `author_name`、`author_avatar_url`，以及互动统计字段 `comment_count` / `up_vote_count` / `bookmark_count`；作者信息由 `author_id` 一次批量解析（非 N+1），统计由聚合查询实时获取（不在 `Post` 实体冗余存储）。

默认排序 `sort=latest`（按 `created_at` DESC）；允许 `sort=top`（`up_vote_count` DESC）与 `sort=most_commented`（`comment_count` DESC）。分页支持两种模式：
- `sort=latest`：基于 `created_at` 的 **cursor** 分页，请求 `cursor=<opaque>`，响应返回 `next_cursor`（可空）与 `has_more`。
- `sort=top` / `sort=most_commented`：**offset** 分页，请求 `page`（从 1 开始，默认 1）与 `size`（默认 20，上限 100，超限以 100 截断），响应返回 `page` / `size` / `total`。

增量能力：列表 SHALL 接受可选地点过滤查询参数 `cityId`（精确匹配帖子 `city_id`，城市 slug）与 `spotId`（匹配帖子 `spot_ids` 数组含该 Spot slug）。当 `cityId` 或 `spotId` 任一非空时，结果过滤为该地点关联的 PUBLISHED 帖子，且此模式忽略 `cursor`（走 offset 分页）；其余排序/分页/作者信息/统计语义不变。响应项 SHALL 增量包含 `city_id` 与 `spot_ids`（见「响应安全边界」白名单）。

响应信封 SHALL 始终包含 `items` / `next_cursor` / `has_more`，offset 模式额外包含 `page` / `size` / `total`。

#### Scenario: 列表仅含已发布且携带作者信息与统计数

- **GIVEN** 存在 3 篇 PUBLISHED 与 2 篇 DRAFT 帖子，其中某 PUBLISHED 帖有 4 条评论（1 条已软删）、6 个 UP 投票、2 个收藏
- **WHEN** `GET /api/posts` 不带鉴权
- **THEN** 返回 `200 OK`，仅含 3 篇 PUBLISHED
- **AND** 该项含 `author_name`（=作者 `User.displayName`）与 `author_avatar_url`（=作者 `User.avatarUrl`）
- **AND** 该项 `comment_count` = 3（含回复、排除软删）、`up_vote_count` = 6、`bookmark_count` = 2

#### Scenario: 分页 size 上限截断

- **WHEN** `GET /api/posts?size=200`
- **THEN** 实际生效 `size` 为 100，响应含分页元信息

#### Scenario: 作者已软删时帖子仍展示、作者名回退

- **GIVEN** 某 PUBLISHED 帖子的作者已被软删除（`DELETED`）
- **WHEN** 该帖子出现在列表
- **THEN** 帖子照常展示，`author_name` 回退为占位文案（如 `"[unknown user]"`），不泄露作者 `email` 等敏感字段

#### Scenario: 默认 latest 排序与 cursor 翻页

- **GIVEN** 存在 25 篇 PUBLISHED 帖子，`size=20`
- **WHEN** 首次 `GET /api/posts?sort=latest`
- **THEN** 返回 20 项，`has_more` = true，`next_cursor` 非空
- **AND** 当携带该 `next_cursor` 再次请求时，返回后续 5 项，`has_more` = false，`next_cursor` 为空

#### Scenario: 切到 top / most_commented 走 offset 分页

- **WHEN** `GET /api/posts?sort=top&page=2&size=10`
- **THEN** 返回第 2 页 10 项，按 `up_vote_count` DESC 排序，响应含 `page` = 2、`size` = 10、`total` 为 PUBLISHED 总数
- **AND** 此模式下忽略 `cursor` 参数（若存在）

#### Scenario: 城市页聚合相关攻略

- **GIVEN** 存在 `city_id=hangzhou` 的若干 PUBLISHED 帖子
- **WHEN** `GET /api/posts?cityId=hangzhou`
- **THEN** 仅返回 `city_id=hangzhou` 的 PUBLISHED 帖子，响应项含 `city_id`

#### Scenario: POI 关联多攻略

- **WHEN** `GET /api/posts?spotId=hangzhou-west-lake`
- **THEN** 返回 `spot_ids` 含 `hangzhou-west-lake` 的所有 PUBLISHED 帖子

---

### Requirement: 响应安全边界——白名单与敏感字段隔离

`PostResponse` / `PostSummary` SHALL 采用白名单 DTO 输出，字段严格限定为：`id` / `title` / `content` / `cover_image_url` / `tags` / `status` / `author_id` / `author_name` / `author_avatar_url` / `summary` / `created_at` / `updated_at` / `comment_count` / `up_vote_count` / `bookmark_count` / `city_id` / `spot_ids` / `request_id`（顶层信封）。任何响应 SHALL NOT 包含 `deleted_at`；作者信息 SHALL 仅限 `display_name` + `avatar_url`，不得泄露 `email` 等凭证 / 隐私字段。所有成功与错误响应均携带顶层 `request_id`（源自 `RequestIdFilter`），契约以 `frontend/openapi/openapi.json` 为准。

#### Scenario: 详情响应不含 deleted_at

- **WHEN** `GET /api/posts/{id}` 返回 `200`
- **THEN** 响应 JSON 中**不**出现 `deleted_at` / `deletedAt` 子串

#### Scenario: 作者信息不含邮箱

- **WHEN** 列表 / 详情返回含 `author_name` 的帖子
- **THEN** 响应 JSON 中**不**出现作者 `email` 字段

---

## ADDED Requirements

### Requirement: Post 地点关联

`Post` 实体 SHALL 增量可选 `city_id`（单列字符串，存 city slug，可空）与 `spot_ids`（`List<String>`，JSON 数组，存 Spot slug，缺省空数组，可空视为空）。

- `POST /api/posts` SHALL 接受可选 `city_id` / `spot_ids`（缺省为空），由服务端归一化（`trim`、小写、去空、去重、上限 20）后落库。
- `PUT /api/posts/{id}` SHALL 允许补丁式更新 `city_id` / `spot_ids`（请求为 `null` 时保留原值）。
- `GET /api/posts/{id}` 详情响应 SHALL 含 `city_id` / `spot_ids`。
- 城市详情页「相关攻略」区 SHALL 调用 `GET /api/posts?cityId={citySlug}`；景点详情页「相关攻略」区 SHALL 调用 `GET /api/posts?spotId={spotSlug}`。

#### Scenario: 创建带地点关联的帖子

- **WHEN** 提交 `POST /api/posts` 含 `{ "title": "...", "content": "...", "city_id": "Hangzhou ", "spot_ids": ["Hangzhou-West-Lake", "  LINGYIN "], "status": "PUBLISHED" }`
- **THEN** 返回 `201 Created`，落库 `city_id="hangzhou"`、`spot_ids=["hangzhou-west-lake","lingyin"]`（归一化：小写、去空白、去重）

#### Scenario: 按城市过滤返回关联攻略

- **GIVEN** 存在 `city_id=hangzhou` 的 PUBLISHED 帖子
- **WHEN** `GET /api/posts?cityId=hangzhou`
- **THEN** 返回该地点关联的 PUBLISHED 帖子，响应项含 `city_id`

#### Scenario: 按 POI 过滤返回多攻略

- **GIVEN** 存在 2 篇 `spot_ids` 均含 `hangzhou-west-lake` 的 PUBLISHED 帖子
- **WHEN** `GET /api/posts?spotId=hangzhou-west-lake`
- **THEN** 返回这 2 篇帖子（命中 `spot_ids` 数组包含匹配）
