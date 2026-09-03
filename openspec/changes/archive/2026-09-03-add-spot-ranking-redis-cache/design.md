# add-spot-ranking-redis-cache — Design (P5)

## Context

现状（见 proposal.md — Why）：`GET /api/spots/ranking` 每个请求执行 `SpotRepositoryImpl.ranking` 原生 SQL；`bookmarks` 一路每次 `LEFT JOIN` 子查询实时聚合 `spot_bookmarks`。三个 type 收敛在同一个 `SpotService.ranking(type, limit)`，对外契约与规格见 `openspec/specs/places/spec.md`「景点排行榜」。

约束 / 既有模式：
- 项目当前**无任何 Redis**，代码注释多处明确"单实例可接受、多实例再换 Redis"；本 change 引入首个外部缓存组件。
- 测试全量走 surefire，`pom.xml` 已有 `<systemPropertyVariables><spring.mail.host>false</spring.mail.host>` 的条件装配哨兵先例（`SmtpMailSender`/`LoggingMailSender` 用 `@ConditionalOnProperty` 互斥装配）。
- `SpotsRankingApiTest` 是 `@SpringBootTest + @Transactional`：每用例清库→灌数据→打 HTTP 断言。**Redis 写入不受事务回滚控制**，共享 Redis 会跨用例污染。
- `SpotSummary` 继承 `BaseResponse`（每元素带 `request_id`，构造时读 MDC），immutable、无 setter、24 参私有构造。
- 排行榜三个 type 的变更来源与频率差异大（view 计数高频、收藏中频、rating 低频），失效策略必须分而治之。

## Goals / Non-Goals

**Goals:**
- `popular`/`rating`/`bookmarks` 三路排行榜经 Redis Cache-Aside 缓存；命中的常见路径（首页区块高频消费 Top N）不再执行聚合 SQL。
- 新鲜度边界显式化：数据最多滞后一个 TTL（5 分钟）；景点写操作与收藏切换即时失效，失效后下个请求即最新。
- Redis 不可用 / 被禁用时服务行为等价于现状（直查 DB 正常返回），缓存不是 SPOF。
- 既有 HTTP 层契约与测试语义不变（测试在缓存关闭下运行）。

**Non-Goals:**
- 不做多实例缓存一致性 / 分布式锁 / 缓存击穿防护（单实例自托管，YAGNI）。
- 不改 `/api/spot-bookmarks`（个人收藏列表）、不改 `SpotRepository.ranking` 的 SQL、不改响应结构与端点路径。
- 不引入 Spring Cache 抽象（`@Cacheable`）——其序列化 / 失效 / fail-safe 语义不可见且难按本项目模式测试，手动 Cache-Aside 更贴合 TDD。
- 不把缓存推广到 `SpotService.list` 等其它查询（本期只服务排行榜）。

## Decisions

### D1 缓存形态：Cache-Aside + 每 key 存 Top 50 规范快照，命中按 `limit` 截断

- key：`spot:ranking:{type}`（type 为归一化后值：`bogus`→`popular` 与 `popular` 共用 key），与需求格式一致，**不在 key 里拼 limit**。
- value：该 type 的 Top 50 完整 `SpotSummary` JSON 快照（不足 50 则存实际条数）。排行榜是有序前缀——Top50 截断即任意 TopN（`limit ∈ [1,50]` 都是该排序的合法前缀），因此**任何请求命中同一 key，按自身 `limit` 切片即可**，语义等价于现行按 `limit` 直查。
- 写回：未命中时以 `PageRequest.of(0, 50)` 调 `spotRepository.ranking(type, …)` 查规范 Top50 → 映射 → 序列化 → `SETEX key json 300`。TTL=300s。
- 读取：命中 → 反序列化 → `subList(0, min(limit, 50, size))` 返回；未命中 → 直查回源。
- 备选（放弃）：key 拼 `:limit` 缓存各档尺寸。缺点：同 type 多个 key、冷启动各自回源、写放大；前缀截断方案以微不足道的"多取几行"换单 key 简单性，故选 D1。

### D2 失效面：写操作 evict，view 计数绝不动缓存

| 变更来源 | 触发点 | 动作 |
|---|---|---|
| 景点 create / update（rating、status、hidden 等字段可进出榜） | `SpotService.create/update` 成功保存后 | `evictAll()`：删 `rating`/`popular`/`bookmarks` 三 key |
| 收藏切换（`bookmarks` 计数变化） | `SpotBookmarkService.toggle` 提交后 | `evictBookmarks()`：仅删 `bookmarks` key |
| 浏览量 +1 | `ViewCountService.recordSpotView` | **不动作**（否则每次详情访问清空缓存 → 命中率归零；`popular` 由 TTL 保鲜，Top 榜次序不因零星访问翻转） |

失效由调用方显式接线（构造器注入 `RankingCacheService`），不引入事件 / AOP 魔法。

维护护栏：任何未来会改变排行可见字段 / 进出榜条件的 Spot 写路径（新增 DELETE 端点、状态批量变更、`places-ingestion` crawler 对 City/Spot 的 upsert 等）都必须在提交后调用 `evictAll()`，遗漏会造成 ≤TTL 的过期残留。当前 Spot 仅 `create`/`update` 两个写入口，本次接线覆盖即完整。

### D3 装配与降级：单 bean + enabled 开关 + fail-safe，镜像 mail 先例

- `RankingCacheService` 恒为 `@Service`，内部持有 `StringRedisTemplate` 与 `app.ranking-cache.enabled`（默认 `true`）。
- `enabled=false`（surefire 注入）→ `getRanking` 完全不碰 Redis，直接走 DB 回源；`evict*` 变 no-op。
- 任何 Redis 操作包 `try/catch`（`RedisConnectionFailureException` 等）：异常 → `log.warn`（一次性节流，避免宕机期刷日志）→ 视同未命中走 DB / 失效忽略。**缓存故障不得让端点 500**。
- 不做启动期自检 / health 接入：Lettuce 懒连接，Redis 不在线时 Spring 上下文照常启动，仅在首次缓存调用时报错并被 fail-safe 吸收。
- 超时硬约束：`application.yml` 配 `spring.data.redis.timeout: 500ms` 与 `spring.data.redis.connect-timeout: 500ms`。Lettuce 默认命令超时高达 60s——若 Redis 主机配置了但宕机 / 网络黑洞，每个排行榜请求会在 catch 之前阻塞数十秒；收敛到亚秒级才能兑现"缓存不成为故障源"（对应 tasks 1.2）。
- 备选（放弃）：`@ConditionalOnProperty` 拆"真缓存 bean / 直查 bean"双实现。会造成 bean 引用分支，且 fail-safe 仍需 try/catch，单 bean + 布尔开关更直白、更易单测（Mockito 直接断言不调用 Redis 模板）。

### D4 序列化：`SpotSummary` 增加 round-trip 能力，专用 cache ObjectMapper 剔除 `request_id`

- 在 `SpotSummary` 现有私有构造器上加 `@JsonCreator` 与逐参 `@JsonProperty("snake_case")`，使其可被 Jackson 反序列化（HTTP 层出网序列化不变）。
- 专用 `ObjectMapper`：**独立 plain ObjectMapper（不复用 / 不 copy HTTP 主 mapper）+ mixin 忽略 `request_id`**，只用于缓存字节读写，**HTTP 层 mapper 不受影响**。理由：`SpotSummary` 全字段由 `@JsonProperty`/`@JsonInclude(ALWAYS)` 注解驱动、无日期与自定义序列化器，plain mapper 输出与 HTTP 逻辑等价；独立 mapper 把缓存字节格式与 HTTP 主 mapper 配置解耦——主 mapper 未来调整（命名策略 / modules / inclusion）不会让已存缓存悄悄脱节，缓存格式显式稳定：
  - 写缓存：DTO → JSON 且不含 `request_id`；
  - 读缓存：JSON → DTO；命中对象在当前请求线程经 `super()`（`BaseResponse`）重建，`request_id` 由当次 MDC 生成——命中响应与回源响应的关联 ID 语义一致，绝不回放写缓存请求的 ID。
- 备选（放弃）A：缓存值存 slug 有序串、命中后按 slug 批量回查水合。省去 DTO 序列化，但命中仍每次查 MySQL（`findBySlugIn`），不满足"命中零 DB"这一本 change 的核心动机。备选（放弃）B：另建专用缓存 DTO 镜像 24 字段，映射代码与字段演进维护面比 `@JsonCreator` 更大。

### D5 代码落位：排行榜唯一入口收敛到 `RankingCacheService`

- `RankingCacheService.getRanking(type, limit)`：归一化 type（非法回退 `popular`）+ 钳制 `limit` ∈ [1,50] + 缓存或回源 + 返回 `List<SpotSummary>`。**禁用态（`enabled=false`）按请求 `limit` 精确回源**，与原实现逐字节等价、不过度取行；启用态且未命中时才以 `PageRequest.of(0, 50)` 查规范 Top50 回源。
- `SpotService.ranking(type, limit)` 改为薄委托（`return rankingCacheService.getRanking(type, limit);`），对既有调用方（`SpotsController`）透明；归一化 / 钳制 / `Spot→SpotSummary` 映射逻辑随入口迁移（现仅 controller 一处调用，无重复消费者）。
- 包落位 `com.mooc.backend.places.service`（与 SpotService 同层，不新开 cache 包——本 change 仅一个缓存服务）。

## Risks / Trade-offs

- [`popular` 榜最多滞后 5 分钟（仅 view 变化）] → 属已接受的显式新鲜度边界，写入 spec 措辞；首页热门榜对零星访问计数不敏感。
- [测试环境忘了关开关 + 本地 Redis 在线 → HTTP 层测试跨用例污染] → 双保险：surefire 硬编码 `<app.ranking-cache.enabled>false</app.ranking-cache.enabled>`（同 mail 哨兵），并在 `SpotsRankingApiTest` 等 HTTP 层测试类上加 `@TestPropertySource(properties = "app.ranking-cache.enabled=false")`——IDE 不经 surefire 直接单跑也被隔离；缓存行为一律由 Mockito 单测覆盖，测试不依赖真 Redis。
- [`@JsonCreator` 使 `SpotSummary` 字段演进需同步维护构造器注解] → 换取的收益是"命中零 DB + request_id 语义正确"；字段变更频率低，接受该维护成本（D4 已对比专用 DTO 方案更重）。
- [缓存未命中并发回源（thundering herd）] → 首次请求低频、单实例，不上分布式锁；如需缓解后续用"单飞（single-flight）"。
- [写失效与并发回源竞态（evict 后旧快照被写回）] → 经典 Cache-Aside 竞态：写请求"提交 DB → evict"期间启动的并发读可能把旧 DB 快照写回、恰好晚于 evict → 旧数据最多存活至 TTL。单实例低频 + 5min TTL 兜底，接受该窗口，不引入版本号 / 锁。
- [生产引入 Redis 是首个外部中间件] → fail-safe 保证上线顺序不敏感（先合代码后起 Redis 也不影响可用性，仅退化为不缓存）；提供 kill switch（`app.ranking-cache.enabled=false`）。

## Migration Plan

1. **本地 Redis**：开发者机器起 `redis-server`（或 `docker run -p 6379:6379 redis:7`）；`application.yml` 的 `spring.data.redis.host/port` 用 `${REDIS_HOST:localhost}` / `${REDIS_PORT:6379}` 环境变量覆盖，供生产指到独立实例。生产部署评估新增 Redis 容器。
2. **代码落地顺序**（apply 阶段按 tasks 执行 TDD）：加依赖与配置 → `SpotSummary` round-trip + 专用 cache mapper → `RankingCacheService` → `SpotService`/`SpotBookmarkService` 接线 evict → 单测 / 既有 HTTP 测试全绿。
3. **契约刷新**：springdoc 描述文字（"实时聚合"→缓存窗口措辞）会改动 `openapi.json` → 起后端(8080) 后 `openapi:sync` + `openapi:gen` + `openapi:drift`。
4. **回滚**：代码回滚该 change 即完全回到直查；或仅设 `app.ranking-cache.enabled=false` 热停缓存，无需改码。

## Open Questions

- 本地 Redis 的启动方式（docker vs 本机安装）与 README 是否需要补"启用本地缓存"小节——运维细节，不阻塞实现，可放到收尾 task 时顺手决定。
