# Design (post-location-tagging)

### 增量 Requirement（归并于 posts spec）

**Requirement: Post 地点关联**

- `Post` 实体 SHALL 增量可选 `city_id`（单城市语境）与 `spot_ids`（`string[]`）。
- `POST /api/posts` SHALL 接受可选 `city_id` / `spot_ids`（缺省为空）。
- `GET /api/posts` SHALL 接受 `cityId`（精确匹配城市）与 `spotId`（匹配 `spot_ids` 含该值）过滤参数，返回该地点关联已发布 Post。
- 地点页相关攻略区 SHALL 调用上述过滤。

#### Scenario: 城市页聚合相关攻略

- **GIVEN** 存在 `city_id=hangzhou` 的若干 Post
- **WHEN** 渲染 `/cities/hangzhou` 相关攻略区
- **THEN** 调用 `GET /api/posts?cityId=hangzhou` 并展示

#### Scenario: POI 关联多攻略

- **WHEN** `GET /api/posts?spotId=hangzhou-west-lake`
- **THEN** 返回 `spot_ids` 含该 slug 的所有已发布 Post

- 数据模型：`city_id` 存 city slug（或主键 + 冗余 slug 便于查询）；`spot_ids` 存 Spot slug 数组。
- 索引：对按 `city_id` 过滤建索引。
