# post-location-tagging — Proposal (P6)

## Why

景点/城市详情页需聚合"相关攻略"。`posts` 模块当前无地点信息，需增量 `city_id` / `spot_ids` 并支持按地点过滤，使 `spots-frontend-mock` 的 mock 占位可被真实数据替换。

## Scope

- `posts` 实体增量 `city_id`（可选，单城市语境）与 `spot_ids`（`string[]`，可多 POI）。
- `POST /api/posts` 接受（可选）上述字段。
- `GET /api/posts` 增量 `cityId` / `spotId` 过滤参数。
- 详情页相关攻略区接真实聚合（替换 `spots-frontend-mock` 的 mock）。

## Impact

- 增量更新 `posts` spec（本 change 拥有该 Requirement，见 design.md）。
- 详情页（spots-frontend-mock 产出）相关攻略区从 mock 切真实。
- 依赖 `api-spots`（Spot/City slug 已存在）与 `posts` 模块。
