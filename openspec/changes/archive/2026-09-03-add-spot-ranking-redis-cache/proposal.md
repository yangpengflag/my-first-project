# add-spot-ranking-redis-cache — Proposal (P5)

## Why

`GET /api/spots/ranking` 目前每个请求都直接执行原生 SQL：`rating`/`popular` 各扫一次 `spots`，`bookmarks` 每次 LEFT JOIN 子查询实时聚合 `spot_bookmarks`。排行榜被首页"热门景点"等高访问区块消费后，这部分读会成为 MySQL 的主要负载来源。需要一层缓存把"昂贵但弱实时"的聚合查询挡住。

## What Changes

- **新增 Redis 依赖与连接配置**：`pom.xml` 加 `spring-boot-starter-data-redis`；`application.yml` 加 `spring.data.redis`（默认 `localhost:6379`，连接串走环境变量覆盖，不写死生产地址）。
- **新增 `RankingCacheService`（Cache-Aside 两层）**：
  - `getRanking(type, limit)`：先查 Redis key `spot:ranking:{type}`（value 存 Top 50 整份，命中时按请求 `limit` 截断返回）→ 命中直接返回；未命中调 `SpotRepository.ranking` 查库 → 序列化回写 Redis（TTL 5 分钟）→ 返回。
  - `evictRanking()`：删除 `rating` / `popular` / `bookmarks` 三个 key；`evictBookmarks()`：仅删 `bookmarks` key。
- **改造 `SpotService.ranking`**：不再直接查库，改为委托 `RankingCacheService`；`SpotService.create/update` 成功后 evict 全部 ranking key；`SpotBookmarkService.toggle` 成功后 evict `bookmarks` key；**view 计数路径绝不 evict**（否则命中率归零，`popular` 靠 TTL 保鲜）。
- **`SpotSummary` 增加 JSON round-trip 能力**：Redis 回读需要反序列化（当前 immutable、无 setter、私有 24 参构造）；缓存值不含 `request_id`，命中时对象在当前请求线程重建、`request_id` 按当次请求从 MDC 生成（避免回放首个请求的关联 ID）。
- **装配与降级**：缓存 bean `@ConditionalOnProperty`（默认开启；surefire 测试通过系统属性关闭，隔离 Redis 跨事务残留）；Redis 连接失败时 catch → fail-safe 直查 DB，**缓存不成为 SPOF**。
- **契约措辞调整**：`places` spec 的"收藏榜按实时聚合"改为缓存窗口内近实时语义（详见 Modified Capabilities）。**非 BREAKING**——路径 / 参数 / 响应结构不变，仅数据新鲜度边界被显式化。

## Capabilities

### New Capabilities

- 无（本 change 不引入新能力面，全部落在既有 `places` 排行榜行为上）。

### Modified Capabilities

- `places`（`openspec/specs/places/spec.md`）：景点排行榜新鲜度语义——原"bookmarks 实时聚合"放宽为"≤ TTL（5 分钟）缓存窗口内近实时"；写入（景点 create/update、收藏 toggle）触发缓存失效、失效后下个请求即最新；补充"Redis 不可用时排行榜自动回退直查数据库、仍可用"的可用性保证。控制器 / 仓库注释与 springdoc 描述中的"实时聚合"字样同步更新。

## Impact

- **后端依赖**：`backend/pom.xml` 新增 `spring-boot-starter-data-redis`（Spring Boot 3.5.16 托管的 Lettuce 版本）。
- **后端代码**：
  - 新增 `places/service/RankingCacheService.java`（或等价的 `cache` 包）及对应测试。
  - `SpotService.ranking` 委托缓存；`SpotService.create/update`、`SpotBookmarkService.toggle` 接线 evict。
  - `SpotSummary` 增加反序列化支持（构造器 `@JsonCreator` 方案或专用缓存 DTO，见 design）。
  - `SpotsController` 路径签名不变；springdoc 描述文字微调。
- **配置**：`application.yml` 增 `spring.data.redis.*`；surefire `<systemPropertyVariables>` 增缓存关闭哨兵值（复用 `spring.mail.host=false` 既有模式）。
- **测试**：`SpotsRankingApiTest` 在缓存关闭下保持原样全绿（每次清库灌数据，语义不变）；`RankingCacheService` 用 Mockito 单测覆盖命中 / 未命中 / TTL / evict / fallback，不依赖真 Redis。
- **API 契约**：端点路径 / 参数 / 响应结构零变化；springdoc 描述文字变化会轻微影响 `openapi.json` 快照 → 需 `openapi:sync` + `openapi:gen` + `openapi:drift`。
- **运维**：本地开发与生产需具备 Redis（本地默认 `localhost:6379`）；Redis 缺失 / 宕机时服务自动退化为直查（可容忍但不缓存）。生产部署形态（单实例 Docker）需评估是否新增 Redis 容器。
