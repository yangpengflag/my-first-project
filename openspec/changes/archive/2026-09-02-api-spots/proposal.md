# api-spots — Proposal (P4)

## Why

`spots-frontend-mock` 以 mock 跑通 UI 后，需要真实后端提供 City/Spot 数据与 REST API，并把前端从 mock 切到真实 fetch。

## Scope

- 后端新增 `City` / `Spot` JPA 实体（继承 `BaseEntity`），字段对齐 `specs/places`。
- REST：`GET /api/cities`、`GET /api/cities/{slug}`、`GET /api/spots`、`GET /api/spots/{slug}`。
- OpenAPI 生成 `openapi.json`；前端 `lib/places` 增加 `fetchCities` / `fetchSpots`（接 `lib/backend.ts`），首页/列表/详情切真实 fetch。
- `openapi:drift` 校验契约一致。

## Out of Scope

- AI 爬虫采集（属 `places-ingestion`，后续接入落地数据）。
- Post 地点关联（属 `post-location-tagging`）。

## Impact

- 新增后端 `places` 实体与 repository/service/controller。
- 更新 `backend/` submodule 指针。
- 前端 `lib/places` 由 mock 切真实客户端（P0 类型需与生成客户端一致）。
- 依赖 `spots-frontend-mock` 已合并。

## Open items（review #5，本期落实机制）

- `viewCount` 累加：详情页访问 +1，采用异步 + 防刷；具体实现在本 change 落地（不依赖评价系统）。
