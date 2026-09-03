## MODIFIED Requirements

### Requirement: 景点排行榜（Spot Ranking）

系统 SHALL 提供公开排行榜端点：

- `GET /api/spots/ranking?type=rating|popular|bookmarks&limit=10`（默认 `popular`，`limit` 默认 10、上限 50）。
- 排序：
  - `rating`：`rating` 降序，无评分者沉底。
  - `popular`：`view_count` 降序。
  - `bookmarks`：按 `spot_bookmarks` 收藏计数降序。
- 仅返回 `PUBLISHED`；返回 `SpotSummary[]`（截断 `limit`）。
- 公开免鉴权（被 `GET /api/spots/*` permitAll 覆盖）。
- 新鲜度：排行榜响应 SHALL 允许由缓存提供（Cache-Aside，TTL 5 分钟）；响应数据 SHALL 保证反映不早于 5 分钟前的数据库状态（最多滞后一个 TTL）。景点写操作（create/update）与收藏切换完成后，系统 SHALL 使相关排行榜缓存失效，令失效后的排行榜请求返回最新数据（写入与并发回源竞态窗口除外——该窗口内陈旧度仍不超过一个 TTL）。仅浏览量变化不触发失效，`popular` 榜在该场景下最多滞后一个 TTL。
- 可用性：缓存不可用（Redis 连接失败 / 超时）时，排行榜 SHALL 自动回退直查数据库并正常返回——缓存不得成为排行榜端点的故障源。

#### Scenario: 默认按热门

- **WHEN** `GET /api/spots/ranking`（不带参数）
- **THEN** 返回 `view_count` 降序的 `SpotSummary[]`，默认最多 10 条

#### Scenario: rating 无评分沉底

- **GIVEN** 部分 POI `rating` 为 `null`
- **WHEN** `GET /api/spots/ranking?type=rating`
- **THEN** 有评分者按 `rating` 降序在前，`rating=null` 者排末尾

#### Scenario: 收藏榜按实时聚合

- **GIVEN** slugA 被 3 个用户收藏、slugB 被 1 个用户收藏（缓存已失效或未命中）
- **WHEN** `GET /api/spots/ranking?type=bookmarks`
- **THEN** 首位为 slugA

#### Scenario: limit 钳制

- **WHEN** `GET /api/spots/ranking?limit=200`
- **THEN** 返回条数不超过 50

#### Scenario: 收藏切换后下个请求即最新

- **GIVEN** 某用户对 slugA 的收藏切换已提交，且无并发排行榜请求正在回源
- **WHEN** 随后的 `GET /api/spots/ranking?type=bookmarks`
- **THEN** 返回结果反映该切换（收藏数增减即时生效），而非依赖 TTL 自然过期

#### Scenario: 缓存不可用时自动回退数据库

- **GIVEN** Redis 不可用
- **WHEN** `GET /api/spots/ranking`
- **THEN** 仍返回正常排序结果（直查数据库），不返回 5xx
