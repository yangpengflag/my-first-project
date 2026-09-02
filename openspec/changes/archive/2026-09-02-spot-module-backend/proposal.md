# Proposal — spot-module-backend

## Why

`api-spots` / `city-module` 已交付景点**只读** API 与前端接入，但业务闭环仍缺三块能力（用户 `/opsx:explore` 澄清后确认）：

1. **景点写能力缺失**：数据全靠 `@Profile("seed")` 脚本灌入，无 CMS 写 API（原 `project.md` 定 out-of-scope）。本期放开该约束，补 `POST/PUT /api/spots`。
2. **Post↔Spot 关联真相不一致**：`post-location-tagging`(P6) 在 `Post` 存 `spot_ids` 字符串数组实现帖子关联景点，**非关联表**，且前端攻略区已依赖 `GET /api/posts?spotId=`。用户要求"多对多关联表"统一真相，需迁移。
3. **排行榜与收藏缺失**：列表已有 `popular/hidden` 排序，但无独立排行榜端点；`rating` 字段未暴露为榜；Spot 无收藏能力（现有 `bookmarks` 仅针对 Post），故"收藏 Top N"无法支撑。

用户决策（explore 澄清）：关联表迁移、做完整写 API、本期做 Spot 收藏、独立 `/ranking` 端点。

## What Changes

- **M1 关联表迁移**：删 `Post.spotIds` JSON 列，新建 `post_spots(post_id, spot_slug)` 关联表；`PostsController` 写路径改为读写 `post_spots`；`GET /api/posts?spotId=/cityId=` 改为 join 查询（**前端 query 参数名不变**）。
- **M2 Spot.status**：`Spot` 新增 `status`（`SpotStatus`: DRAFT/PUBLISHED，与 Post 对齐）；公开读仅返回 PUBLISHED；seed 灌 PUBLISHED。
- **M3 Spot 写 API**：`POST /api/spots` + `PUT /api/spots/{slug}`（JWT 鉴权）；`CreateSpotRequest`/`UpdateSpotRequest`；slug 自动生成（复合 `{citySlug}-{slugify(nameEn)}`，冲突 409）；校验 citySlug 存在。
- **M4 Spot 收藏**：新建 `spot_bookmarks(spot_slug, user_id)` 表 + `SpotBookmark` 实体；`POST /api/spots/{slug}/bookmark`（toggle）、`GET /api/spots/{slug}/bookmark`（状态）、`GET /api/spot-bookmarks`（我的列表，均鉴权）；实时收藏计数。
- **M5 排行榜端点**：`GET /api/spots/ranking?type=rating|popular|bookmarks&limit=N` 返回 `SpotSummary` Top N（公开读）。

## Impact

- **后端**：`places`（Spot 加 status、写 Controller/Service、ranking）、`posts`（去 spotIds、加 post_spots、写 API 改存）、新增 `spot-bookmarks` 模块；`SecurityConfig` 写端点默认 `authenticated()`，`/api/spots/ranking` GET 已随 `/api/spots/*` 公开、无需额外配置。
- **DB**：新增 `post_spots`、`spot_bookmarks` 表；`spots` 加 `status` 列；需一次性数据迁移 `posts.spot_ids` → `post_spots`。
- **前端**：`lib/places` 攻略区保持 `spotId/cityId` query 不变（可选新增 ranking 调用）；`openspec` 增量 places spec + `project.md` 放开 CMS 写 API out-of-scope 约束。
- **回改已归档 P6**：`Post` 去 `spotIds` 后，前端 `getRelatedPostsForCity/ForSpot` 契约不变（仍 `?spotId=/cityId=`），但需重跑 `openapi:drift` 校验一致性。
