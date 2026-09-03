# Tasks — spots-data-correctness

> **TDD 纪律**：每个实现任务前先写失败测试（RED），确认它因预期原因失败，再实现（GREEN），最后按需重构。
> 跳过 RED 直接实现的，视为未完成。
>
> **跑测试前**（见 `design.md` R2）：MySQL 在运行、8080 端口空闲、`wanderchina` 库未被锁。
> Maven 需先 `set JAVA_HOME=D:\Programs\java17`（默认 JDK 8 会因文本块报「未结束的字符串文字」）。

## 1. `search()` 分页确定性 —— 阻塞项，最高优先级

- [ ] 1.1 **RED**：`SpotRepositoryTest` 新增 `分页在排序键全等时不重不漏`
      ——造 5 条 `view_count` 全为 0、`hidden_gem` 全为 false 的 Spot，以 `size=2` 从 page 1 逐页取到
      `total` 条，断言：并集大小 == 5、无重复 slug、不漏任何 slug。
      （沿用既有 `@BeforeEach` 清空 + `@Transactional` 回滚模式）
- [ ] 1.2 **RED→GREEN**：`SpotRepositoryImpl.search()` 的 `popular` 分支
      `ORDER BY s.view_count DESC` → `ORDER BY s.view_count DESC, s.slug ASC`
- [ ] 1.3 **RED→GREEN**：同上覆盖 `sort=hidden` 分支
      → `ORDER BY s.hidden_gem DESC, s.view_count DESC, s.slug ASC`
- [ ] 1.4 **回归确认**：既有 `PlacesApiTest` / `SpotServiceTest` 中依赖列表顺序的断言仍绿
      （顺序由 22 条真实种子数据驱动，tie-breaker 仅在并列时生效，预期无破坏）

## 2. `ranking()` tie-breaker 补齐

- [ ] 2.1 **RED**：`SpotRepositoryTest`（或 `SpotsRankingApiTest`）新增
      `排行榜在排序键全等时返回顺序稳定` —— 造多条 `rating` 全为 null 的 Spot，
      连续两次调用 `ranking("rating", ...)`，断言两次返回顺序完全一致
- [ ] 2.2 **GREEN**：三分支末端追加 `, s.slug ASC`
      - `popular`：`ORDER BY s.view_count DESC, s.slug ASC`
      - `rating`：`ORDER BY s.rating IS NULL ASC, s.rating DESC, s.slug ASC`
      - `bookmarks`：`ORDER BY COALESCE(b.cnt, 0) DESC, s.view_count DESC, s.slug ASC`
- [ ] 2.3 **回归确认**：既有 `SpotsRankingApiTest` 全绿（含 `limit` 钳制、无评分沉底、收藏榜聚合）

## 3. 种子数据补全

- [ ] 3.1 **RED**：`PlacesSeederTest` 新增断言
      - 每个种子景点 `tags` 非空（`JSON_LENGTH(tags) > 0`）；
      - 每个种子景点 `rating` 非 null；
      - 存在 `featured == true` 的样本，且存在 `hiddenGem == true` 的样本；
      - 每个标签词至少被 2 个景点使用（保证标签筛选器能筛出多条，不退化成搜索框）
- [ ] 3.2 **GREEN**：`PlacesSeeder.SpotSeed` record 扩展
      `List<String> tags` / `Double rating` / `boolean featured` / `boolean hiddenGem`，
      并按下述原则填充 22 条（`design.md` D3）：
      - `tags`：每景点 2–3 个，只用可复用词表（UNESCO / Must-see / Free / Photo / Family /
        Hiking / Food / Temple / Museum / Old Town / Night View / Cable Car）
      - `rating`：4.0–4.9 一位小数，按知名度给梯度，避免大面积并列
      - `featured`（6–8 条）：城市标志性景点（故宫 / 兵马俑 / 西湖 / 熊猫基地 / 布达拉宫 / 外滩 / 漓江）
      - `hiddenGem`（5–7 条）：非旅行团主线（芦笛岩 / 天坛 / 大昭寺 / 磁器口 / 武侯祠 / 灵隐寺）
      - `Spot.create(...)` 签名**不变**，仅改调用侧实参（当前传的是 `List.of()` / `null` / `false` / `false`）
- [ ] 3.3 **数据落库验证**（`design.md` R1，易漏）：
      `seedSpot` 是幂等跳过语义，改完 seeder 重启**不会**更新既有 22 行。须先
      `DELETE FROM wanderchina.spots;`，再以 `seed` profile 启动，
      然后 `SELECT slug, rating, tags, featured, hidden_gem FROM wanderchina.spots LIMIT 5;`
      确认 rating 非 null、tags 非空
- [ ] 3.4 **补种福州，恢复重名消歧覆盖**：下游 `spots-list-infinite-scroll` 会把前端 mock
      对齐后端种子数据，届时 mock 里唯一的重名样例 `fuzhou-west-lake` 将消失
      （它是孤儿数据，挂在并不存在的城市上，真后端会因外键约束拒绝）。
      为使 `specs/places` 的「重名 POI 各自可寻址」Scenario 在**真实数据**上仍可验证，
      在 `PlacesSeeder` 增加城市 `Fuzhou / 福州`，并配 **2 个**景点
      （满足 spec「每城市至少 2 个景点」）：
      - 福州西湖 / West Lake（与杭州西湖重名，构成消歧样本）
      - 三坊七巷 / Three Lanes and Seven Alleys
      测试：断言 `fuzhou-west-lake` 与 `hangzhou-west-lake` 可分别按 slug 取到且内容不同

## 4. 验证与收尾

- [ ] 4.1 后端 `SpotRepositoryTest` / `PlacesSeederTest` / `SpotsRankingApiTest` / `PlacesApiTest` 全绿
      （不要求全量 `mvn test` 无红，见 `design.md` R3）
- [ ] 4.2 前端 `type-check` / `test` / `build` 全绿（本 change 不改前端，确认无回归即可）
- [ ] 4.3 `npm run openapi:drift`（需后端在 8080 运行）确认无契约漂移——预期无变更
- [ ] 4.4 手工验证：启动后端 + 前端，打开 `/spots` 确认卡片评分区与标签可见、
      标签筛选器能筛出结果、`sort=hidden` 有内容
