# Design — spot-module-backend

## Decisions

### D1. Post↔Spot 关联表（替代 P6 的 spot_ids）

- 删 `Post` 实体 `spotIds` 字段（列 `spot_ids` 由 Hibernate `ddl-auto=update` 在重建/忽略；本地 MySQL 需 `ALTER TABLE posts DROP COLUMN spot_ids` 或重建）、`CreatePostRequest.spotIds`/`UpdatePostRequest.spotIds`、构造/更新签名。
- **同步清理链（易漏，必须一起改）**：
  - `PostSummary`：删 `spot_ids` 字段 + 构造参 + `from(...)` 取 `post.getSpotIds()` + `WHITELISTED_FIELDS` 去 `spot_ids`
  - `PostResponse`：同上（含 `PostResponseSerializationTest` 断言同步删 `spot_ids`）
  - `UpdatePostRequest`：删 `spotIds` 记录组件
  - 前端：`npm run openapi:sync` + `openapi:gen` 重生成 `api.generated.ts`（去掉 `spot_ids`）；前端攻略区仅用 `?spotId=/cityId=` query，不读 `post.spot_ids`，无渲染依赖
- 新建关联表（显式实体，不用 `@ManyToMany` —— Spot 以 slug 为键、需独立按 slug 反查）：
  ```sql
  CREATE TABLE post_spots (
    post_id   binary(16)   NOT NULL,
    spot_slug varchar(255) NOT NULL,
    PRIMARY KEY (post_id, spot_slug),
    UNIQUE (post_id, spot_slug),
    INDEX idx_post_spots_spot (spot_slug)
  );
  ```
  - 实体 `PostSpot`：`@Entity` + `@Id UUID id` + `postId`(binary) + `spotSlug`(varchar) + 唯一约束 `(postId, spotSlug)`。
- **`PostRepositoryImpl.search` 必须同步改**（删 `spot_ids` 列后，原 `JSON_CONTAINS(p.spot_ids,...)` 分支会 SQL 报错）：
  - `spotId` 分支改为 `JOIN post_spots ps ON p.id=ps.post_id WHERE ps.spot_slug=?`（替换原 JSON 过滤）
  - `cityId` 分支保留（`posts.city_id` 仍在，不进关联表）
  - 无需新增 `findPublishedBySpotSlug`/`findPublishedByCityId`（`search` 已覆盖列表/攻略区两种过滤）
- `PostsController.create/update` → `PostService`：`spotSlugs` 写入/刷新 `post_spots`（先删后插或 upsert；Post 实体不再持有该列表）。
- **数据迁移（一次性，本地 MySQL）**：
  ```sql
  INSERT INTO post_spots (post_id, spot_slug)
  SELECT p.id, JSON_UNQUOTE(je.spot)
  FROM posts p
  CROSS JOIN JSON_TABLE(p.spot_ids, '$[*]' COLUMNS (spot VARCHAR(255) PATH '$')) je
  WHERE p.deleted = false AND JSON_LENGTH(p.spot_ids) > 0;
  ALTER TABLE posts DROP COLUMN spot_ids;
  ```
  H2 测试环境无数据，测试用构造 `PostSpot` 行断言。

### D2. Spot.status

- 新枚举 `SpotStatus { DRAFT, PUBLISHED }`（与 `PostStatus` 对齐；HIDDEN/精选由既有 `hiddenGem`/`featured` 承载，不进 status）。
- `Spot` 加：
  ```java
  @Enumerated(STRING)
  @ColumnDefault("'PUBLISHED'")
  @Column(name = "status", nullable = false, length = 16)
  SpotStatus status = PUBLISHED;
  ```
  > **⚠️ NOT NULL 坑**：本地 `spots` 表已有 seed 行，`ddl-auto=update` 加 NOT NULL 列若无 default 会失败。`@ColumnDefault("'PUBLISHED'")` 让 Hibernate 生成的 `ADD COLUMN` 带 default；MySQL 手工迁移用 `ADD COLUMN status varchar(16) NOT NULL DEFAULT 'PUBLISHED'`。
- `Spot.create(...)` 增 `status` 参；`SpotSummary`/`SpotDetail` 暴露 `status`。
- 公开读契约：`list` 与 `getBySlug` 仅返回 `status=PUBLISHED`（DRAFT → 列表不出现、详情 404）；写 API 可置 DRAFT。
- `places-ingestion` seed 设 `PUBLISHED`。

### D3. Spot 写 API（JWT 鉴权，不持久化 creator）

- 端点：`POST /api/spots`（创建）、`PUT /api/spots/{slug}`（**部分更新，PATCH 语义：null 保留原值，与 `Post.UpdatePostRequest` 一致**）。**本期不含 `DELETE /api/spots`**（删除非需求范围）。
  - **鉴权**：写端点默认 `anyRequest().authenticated()` 覆盖，控制器从 `SecurityContextHolder` 取 userId 仅作**鉴权凭证**（确认是登录用户），**不持久化到 Spot**（CMS POI 无需归属；后续可加 `@PreAuthorize("hasRole('ADMIN')")`）。
  - **`Spot` 需新增 `update(...)` 方法**（现仅 `create`）：局部替换非空字段并 `touch(now)`。
- `CreateSpotRequest`：`nameEn`(@NotBlank)、`nameZh`(@NotBlank)、`descriptionEn`、`descriptionZh`、`coverImageUrl`(URL 校验)、`galleryUrls`(List<URL>)、`tags`(List<String>)、`citySlug`(@NotBlank)、`category`(SpotCategory)、`status`(SpotStatus, 缺省 PUBLISHED)、`level`、`addressEn/Zh`、`lat`、`lng`、`openingHours`、`ticketInfo`、`visitDuration`、`rating`、`featured`、`hiddenGem`。
- `UpdateSpotRequest`：同字段 optional（record 组件 nullable，null = 保留原值）。
- slug 生成：`{citySlug}-{Slugify(nameEn)}`（复用 `places/domain/CitySlugs.slugify`）；冲突 → `409 SPOT_SLUG_CONFLICT`。
- **slug 创建时生成后不可变**：`UpdateSpotRequest` 不重算 slug（仅创建时推导，避免关联/URL 断裂）。
- 校验：`citySlug` 经 `CityService.findBySlug` 存在，否则 `CITY_NOT_FOUND`。
- `SpotService.create/update`：写路径**不触发** `viewCount`（`ViewCountService` 仅详情 GET 调）。

### D4. Spot 收藏（参考 `bookmarks` 模块）

- 表 `spot_bookmarks`：`spot_slug varchar(255) NOT NULL` + `user_id binary(16) NOT NULL` + 唯一 `(spot_slug, user_id)` + PK id。
- 实体 `SpotBookmark`（拷贝 `Bookmark` 结构，`postId`→`spotSlug`）：`create(spotSlug, userId, now)`、物理删取消。
- `SpotBookmarksController`（`/api` 前缀，参考 `BookmarksController` 的 `currentUserId()`）：
  - `POST /api/spots/{slug}/bookmark` → toggle（鉴权）
  - `GET /api/spots/{slug}/bookmark` → **`SpotBookmarkStatusResponse`**（新建 DTO，含 `spotSlug` + `bookmarked`，鉴权）
  - `GET /api/spot-bookmarks?page=&size=` → **`Page<SpotSummary>`**（按收藏时间倒序，鉴权；不复用 post 的 `BookmarkSummary`）
- `SpotBookmarkService`：`toggle`/`isBookmarked`/`listSpotBookmarks`；`SPOT_NOT_FOUND` 已存在。
- 计数：排行榜用实时聚合 `SELECT spot_slug, COUNT(*) c FROM spot_bookmarks GROUP BY spot_slug`，**不冗余存储**（Top N 量小）。

### D5. 排行榜端点

- `GET /api/spots/ranking?type=rating|popular|bookmarks&limit=10`（默认 `popular`，`limit` 默认 10、上限 50）。
- `SpotsController.ranking`（或新 `SpotRankingController`）：
  - `rating`：WHERE status=PUBLISHED `ORDER BY rating IS NULL ASC, rating DESC`（**MySQL 不支持 `NULLS LAST` 语法**，用 `IS NULL ASC` 把无评分排末尾）
  - `popular`：ORDER BY view_count DESC
  - `bookmarks`：LEFT JOIN 聚合子查询 ON s.slug=b.spot_slug ORDER BY COALESCE(b.c,0) DESC
  - 返回 `List<SpotSummary>`（截断 `limit`）。
- **SecurityConfig**：`/api/spots/ranking` 已被现有 `.requestMatchers(HttpMethod.GET, "/api/spots/*").permitAll()` 覆盖（`*` 匹配 `ranking`），**无需额外改动**（本任务仅复核确认）。

## 复用与约束

- 鉴权取 userId 模式照搬 `BookmarksController.currentUserId()`。
- JSON 列（tags/galleryUrls）、slug 唯一、软删 `deleted=false` 过滤沿用现有 `places` 约定。
- `ErrorCode` 已有 `SPOT_NOT_FOUND`/`CITY_NOT_FOUND`；新增 `SPOT_SLUG_CONFLICT`。
- 写 API 不触发 `viewCount`。
- 前端：`lib/places` 攻略区 query 名不变；`/ranking` 为新增可选调用，不阻塞现有页。

## Open Questions（已与用户确认，无遗留）

- 写 API 角色：本期不限角色（JWT 登录即可）。
- 收藏榜：本期做（含写 API + 计数）。
- 关联表：迁移（删 spotIds，统一 post_spots）。
- creator：不持久化（仅鉴权）。
- 删除端点：本期不含（仅 POST/PUT）。
