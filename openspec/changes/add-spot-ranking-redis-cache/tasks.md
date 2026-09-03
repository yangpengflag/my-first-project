# add-spot-ranking-redis-cache — Tasks (P5)

> 实现遵循 TDD：每个功能组先写失败测试（RED）再实现（GREEN）。测试默认以 Mockito 单测为主，不依赖真 Redis。

## 1. 依赖与配置

- [x] 1.1 `backend/pom.xml` 添加 `spring-boot-starter-data-redis`（版本由 Boot 3.5.16 parent 托管）。
- [x] 1.2 `application.yml` 添加 `spring.data.redis.host: ${REDIS_HOST:localhost}`、`port: ${REDIS_PORT:6379}`、`timeout: 500ms`、`connect-timeout: 500ms`，并声明缓存开关 `app.ranking-cache.enabled`（默认 `true`）及用途注释（超时收敛保证 fail-safe 最坏等待亚秒级）。
- [x] 1.3 surefire `<systemPropertyVariables>` 添加 `<app.ranking-cache.enabled>false</app.ranking-cache.enabled>`（镜像既有 `spring.mail.host` 哨兵模式，隔离测试与 Redis）。

## 2. SpotSummary 缓存序列化（round-trip）

- [x] 2.1 测试先行：新增单测——`SpotSummary` 经 cache mapper 序列化后再反序列化 `List<SpotSummary>` 字段一致；序列化字节**不含** `request_id`；null / 空 list / 空 tags 往返不丢。
- [x] 2.2 `SpotSummary` 私有构造器加 `@JsonCreator` + 逐参 `@JsonProperty("snake_case")`，使 `List<SpotSummary>` 可被 Jackson 回读（HTTP 出网序列化不变）。
- [x] 2.3 新增仅用于缓存的独立 `ObjectMapper`（plain 实例 + mixin 忽略 `request_id`，不复用 / 不 copy HTTP 主 mapper），命中反序列化时 `BaseResponse` 构造器按当前线程 MDC 重建 `request_id`。

## 3. RankingCacheService（缓存核心）

- [x] 3.1 测试先行：Mockito 单测覆盖——命中时**不触发** `SpotRepository.ranking`；启用态未命中时回源并把 Top50 写入 `spot:ranking:{type}`（SETEX TTL=300s）；命中按 `limit` 截断（>50 截断到 50；缓存条数 < limit 返回全部）；非法 type 归一化为 `popular` 且共用其 key；`evictAll()` 删除三 key、`evictBookmarks()` 仅删 `bookmarks` key；`enabled=false` 时全程不调 Redis 模板、回源 `limit` 恰为请求值；Redis 抛异常时 fail-safe 直查不抛错。
- [x] 3.2 实现 `RankingCacheService`（`com.mooc.backend.places.service`，`@Service`）：`enabled` 开关 + `StringRedisTemplate` + cache mapper；`getRanking(type, limit)`（type 归一化、limit 钳制 [1,50]、`enabled=false` 按请求 `limit` 精确回源、启用态未命中时 `PageRequest.of(0,50)` 查规范 Top50、`Spot→SpotSummary` 映射、命中按 limit 切片）；`evictAll()` / `evictBookmarks()`；Redis 异常 catch + 节流 `log.warn` + 回源兜底。

## 4. 接线与入口收敛

- [x] 4.1 `SpotService.ranking(type, limit)` 改为薄委托 `rankingCacheService.getRanking(type, limit)`；归一化 / 钳制 / 映射逻辑随入口迁移（确认无其它 ranking 直接消费者）。
- [x] 4.2 `SpotService.create` / `update` 保存成功后调用 `evictAll()`（补单测断言 evict 被触发）。
- [x] 4.3 `SpotBookmarkService.toggle` 提交后调用 `evictBookmarks()`（补单测断言 evict 被触发）。
- [x] 4.4 确认构造依赖无环（`RankingCacheService` 依赖 `SpotRepository`；`SpotService` / `SpotBookmarkService` 依赖 `RankingCacheService`）。

## 5. 契约措辞与 OpenAPI

- [x] 5.1 更新 `SpotsController` springdoc description、`SpotRepositoryImpl` / `SpotService` / `SpotRepositoryCustom` 注释：`bookmarks` 从"实时聚合"改为"≤ 5 分钟缓存窗口内近实时 + 写失效即最新"。
- [x] 5.2 起后端(8080) → `openapi:sync` → `openapi:gen` → `openapi:drift` 通过（快照文字随 description 微调）。
- [x] 5.3 `SpotsRankingApiTest` 等 HTTP 层测试类加 `@TestPropertySource(properties = "app.ranking-cache.enabled=false")` 双保险，确认 surefire 与 IDE 单跑两种方式下均保持全绿（HTTP 层不新增缓存行为断言）。

## 6. 验证与收尾

- [x] 6.1 `mvn test` 全绿（`JAVA_HOME=D:\Programs\java17`，全路径 mvn；确保无残留 `next dev` / 8080 占用进程）。
- [ ] 6.2 本地起 Redis 冒烟：首次请求回源落缓存 → 二次命中不查库 → 修改景点 / 切换收藏后下个请求即最新 → 停 Redis 后端点仍 200（fail-safe）。（手动验证）
- [ ] 6.3 后端子仓 commit；父仓 bump submodule 指针；按需在 README 补"本地启用缓存（redis-server + 开关）"说明。
