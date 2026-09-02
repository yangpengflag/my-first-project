# Tasks — spot-module-backend

> TDD 纪律：每块先写失败测试（RED）→ 实现（GREEN）→ 重构。子模块内提交，父仓末归档。

## M1 关联表迁移（post_spots）

- [x] 1.1 删 `Post` 实体 `spotIds` 字段/构造参数/`getSpotIds`
- [x] 1.2 删 `CreatePostRequest.spotIds` / `UpdatePostRequest.spotIds`
- [x] 1.3 清理出网 DTO：`PostSummary`/`PostResponse` 去 `spot_ids` 字段 + 构造参 + `from(...)` + `WHITELISTED_FIELDS`；同步改 `PostResponseSerializationTest` 断言
- [x] 1.4 新建 `PostSpot` 实体 + `post_spots` 表（PK/唯一/索引）；`PostSpotRepository`
- [x] 1.5 `PostRepositoryImpl.search` 的 `spotId` 分支改 `JOIN post_spots`（删列后原 JSON 过滤会崩）；`cityId` 分支保留；无需新增 findPublishedBySpotSlug
- [x] 1.6 `PostsController`+`PostService` 写路径：`CreatePostRequest`/`UpdatePostRequest` 改收 `spotSlugs`，`PostService` 写入/刷新 `post_spots`
- [x] 1.7 后端测试：`PostRepositoryTest` 关联写入+按 spotSlug/cityId 反查（RED→GREEN）；本地 MySQL 迁移 SQL（`posts.spot_ids`→`post_spots` + DROP COLUMN）
- [x] 1.8 `openapi:sync` + `openapi:gen` 重生成前端 `api.generated.ts`（去 `spot_ids`）；前端攻略区测试仍绿（query 名不变）

## M2 Spot.status

- [x] 2.1 新枚举 `SpotStatus{DRAFT,PUBLISHED}`；`Spot` 加 `status` 列（`@ColumnDefault("'PUBLISHED'")`、`nullable=false`、default PUBLISHED）、`create` 增参
- [x] 2.2 `SpotSummary`/`SpotDetail` 暴露 `status`；`SpotService.list/getBySlug` 仅返回 PUBLISHED
- [x] 2.3 `PlacesSeeder` 灌 `PUBLISHED`；`SpotRepositoryTest` 断言 DRAFT 不进公开列表/详情 404
- [x] 2.4 本地 MySQL 加列用 `DEFAULT 'PUBLISHED'`（避免 NOT NULL 加列失败，见 design D2 ⚠️）

## M3 Spot 写 API

- [x] 3.1 `Spot` 实体新增 `update(...)` 方法（局部替换非空字段 + `touch`）
- [x] 3.2 `CreateSpotRequest`/`UpdateSpotRequest` DTO（字段对齐 design D3，校验注解；UpdateSpotRequest 全 optional）
- [x] 3.3 `SpotsController` 增 `POST /api/spots`、`PUT /api/spots/{slug}`（JWT 取 userId 仅鉴权；slug 生成 + 冲突 409 SPOT_SLUG_CONFLICT）
- [x] 3.4 `SpotService.create/update`（校验 citySlug 存在→CITY_NOT_FOUND；写路径不触发 viewCount）
- [x] 3.5 后端测试：`SpotsController` 写 API 鉴权(401 未带 token)/创建/更新(部分)/冲突/城市不存在（RED→GREEN）

## M4 Spot 收藏

- [x] 4.1 `spot_bookmarks` 表 + `SpotBookmark` 实体（参考 `Bookmark`）
- [x] 4.2 新建 `SpotBookmarkStatusResponse`（含 spotSlug + bookmarked）；列表返回 `Page<SpotSummary>`
- [x] 4.3 `SpotBookmarksController`：`POST /api/spots/{slug}/bookmark`、`GET /api/spots/{slug}/bookmark`、`GET /api/spot-bookmarks`（均鉴权，userId 取 JWT）
- [x] 4.4 `SpotBookmarkService`：`toggle`/`isBookmarked`/`listSpotBookmarks`；`SpotBookmarkRepository`
- [x] 4.5 后端测试：`SpotBookmarksController` 切换/状态/列表/未鉴权 401/景点不存在 404（RED→GREEN）

## M5 排行榜端点

- [x] 5.1 `SpotsController.ranking`：`GET /api/spots/ranking?type=rating|popular|bookmarks&limit=N`（默认 popular/10，上限 50）
- [x] 5.2 三种排序实现（rating NULLS LAST / popular view_count / bookmarks 实时聚合 LEFT JOIN）
- [x] 5.3 复核：`/api/spots/ranking` 已被 `GET /api/spots/*` permitAll 覆盖，**无需改 SecurityConfig**

## 收尾

- [x] 6.1 后端 `mvn test` 全绿（311 tests, 0 fail）；前端 `type-check`/`tests`(215)/`build` 全绿
- [x] 6.2 `npm run openapi:sync` + `openapi:gen` + `openapi:drift`（后端起 8080；本次 review 修复均为内部行为，未改契约，快照已含新增端点/`status`/`spotSlugs` 零 drift）
- [x] 6.3 增量 `places` spec（Spot 写/收藏/排行 Requirement）+ `project.md` 放开 CMS 写 API out-of-scope
- [ ] 6.4 提交 backend/frontend submodule 指针；父仓归档本 change
