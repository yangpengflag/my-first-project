# Spots Frontend (Mock) — Proposal

## Why

首页 `HotSpotsSlot` / `CityGridSlot` 当前为空占位；后端实体与 API 尚未存在。需以**前端 mock 先行**跑通完整景点模块 UI，并把 TS 类型作为后期 `api-spots` 的 API 契约。

## Scope

- P0 契约：新增 `frontend/lib/places/types.ts`（`City` / `Spot` / 分类枚举）+ `mocks.ts`（双语、复合 slug、含重名样例）。
- P1 首页双槽：`HotSpotsSlot`（Top N Spot）+ `CityGridSlot`（Top N City），双语 + 城市后缀。
- P2 列表页：`/cities`、`/spots`（筛选/搜索/分页，复用无限滚动）。
- P3 详情页：`/cities/[slug]`、`/spots/[slug]`（图集/信息/静态位置外链/相关攻略 mock 占位）。

## Out of Scope

- 真实后端 API（属 `api-spots`）。
- AI 爬虫（属 `places-ingestion`）。
- Post 地点关联（属 `post-location-tagging`）；详情页相关攻略本期用 mock。
- Spot 收藏 / 评分系统（`specs/places` 已声明不在本期）。

## Impact

- 填充 `homepage-shell` 的 `city-grid` / `hot-spots` 槽位。
- 新增 `frontend/lib/places/*`；不修改 `backend/` submodule 指针。
- 依赖 `specs/places` 字段契约。

## Dependencies

- `specs/places`（capability spec）
- `frontend-styling-stack`（Tailwind + shadcn/ui + lucide，已在其它 change 落地）
