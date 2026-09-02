# Design (api-spots)

- 实体对齐 `specs/places`：`City`（`slug` 唯一索引）、`Spot`（复合 `slug` 唯一索引、`citySlug` 外键/非空）。
- 枚举 `category` 用英文常量持久化（DB 存 `nature` 等），响应序列化保持 snake_case。
- 分页复用既有模式：列表 `sort=popular` 用 page/size；详情单资源。
- `viewCount`：详情 `GET /api/spots/{slug}` 访问时异步 +1（避免在列表查询里计数）；需防刷（按 IP/用户限频或仅登录态计数，方案实现时定）。
- 前端切换：`lib/places/client.ts` 调用 `lib/backend.ts`；**必须**在 `next.config` 配 `images.remotePatterns` 放行后端图片域名（review #8），否则 P4 远程图 400。
- `rating` / `postCount` 由聚合查询返回（可空/实时），不冗余存储。
