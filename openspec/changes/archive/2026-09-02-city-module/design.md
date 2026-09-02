# Design — city-module

## Context

现状（见 proposal.md Why 与 spec delta）：
- `api-spots` 已交付读 API 与前端接入，但 `cities`/`spots` 均 0 行，且 City 是 21 列"胖模型"（双语摘要、省份、坐标、图集、featured、view_count…），超出当前业务心智。
- `cities` 表 0 行 → 本次是唯一一次改表免数据迁移的窗口。
- 决策约束（用户拍板 + places spec delta）：City = `name`/`nameZh`/`coverImage`/`description`(单字段)/`bestSeason` + 自动 `slug`；Spot schema 不动；数据先脚本导入（爬虫属 P5）。

后端改造清单（实测代码）：
- `City` 实体 / `CitySummary` / `CityDetail`（继承 CitySummary）/ `CityService` / `CityRepository(+Custom/Impl)` / `CitiesController` / `ViewCountService.recordCityView`。
- `Spot` 相关不动（保留 `view_count` 与 category/tags 等），但 `CityService.getBySlug` 中 Top POI 组装依赖 `Spot.viewCount` 排序，保留。

前端改造面（code-explorer 盘点）：`types.ts`/`mocks.ts`/`client.ts`/`index.ts`/`test/mocks/handlers.ts`、`CityCard`/`CityFilters`/`CityDetail`、`cities/page.tsx`/`cities/[slug]/page.tsx`、`CityGridSlot`、`app/page.tsx`，及 Spot 反范式城市名（`cityNameEn/Zh` ← City 名）+ 7 个测试文件。

## Goals / Non-Goals

**Goals**
- City 精简为 7 列（`BaseEntity` 5 列 + `name`/`name_zh`/`slug`/`cover_image`/`description`/`best_season`）。
- `GET /api/cities` 默认按 `name` 升序分页；移除 province/tag/sort 参数与 view 计数。
- 提供幂等种子导入：首批 ~10 城市 + 每城 2–3 景点，景点归属城市可验证。
- 前端契约/映射/展示/测试全量同步。

**Non-Goals**
- 不改 `spots` schema 与 `GET /api/spots` 契约（`view_count` 累加保留）。
- 不做 CMS 写入 API（`project.md` out-of-scope）。
- 不做 AI 爬虫（`places-ingestion` P5）。
- 不新增"策展排序"字段替代 `featured`（如需，另开 change）。

## Decisions

### D1. slug 由 name 自动生成（导入路径）+ DB 唯一约束兜底

slugify 规则（纯 ASCII 城市名场景）：`name.trim().toLowerCase()` → 非 `[a-z0-9]` 连续序列替换为单 `-` → 去两端 `-`。例：`Hangzhou`→`hangzhou`、`Xi'an`→`xi-an`。
- 实现为独立静态工具 `places/domain/CitySlugs.slugify(String)`，种子导入与（未来）写路径复用；`DB UNIQUE(slug)` 作为最终兜底。
- 备选：JPA 事件（@PrePersist）自动填充 —— 弃用：实体现在只有一个构造工厂 `create(...)`，显式生成更可测；`@PrePersist` 隐藏副作用。

### D2. 列表查询回归 Spring Data 派生方法，删除原生 SQL 仓储

`province`/`tag`/`view_count` 排序删除后，`CityRepositoryCustom`/`CityRepositoryImpl`（`JSON_CONTAINS` + 原生 SQL）只剩无意义骨架 → 整个删除，改为派生查询：
- `Page<City> findByDeletedFalse(Pageable)`（service 传 `PageRequest.of(page, size, Sort.by("name"))`）
- `Optional<City> findBySlug(String)`（seed 幂等判重用，含软删行 → 软删行不重灌）
- `long countBySlug…`（seed 断言用，可选）

`findBySlugAndDeletedFalse` 保留（读 API 404 语义）。`incrementViewCountBySlug` 删除（无列）。

### D3. ViewCountService 与 CitiesController 去城市计数

`City.view_count` 列删除后：
- `ViewCountService` 移除 `recordCityView` 与 `CityRepository` 注入，保留 `recordSpotView`（spot 端不动）。
- `CitiesController.get` 移除 `CompletableFuture.runAsync` 计数与 `HttpServletRequest` 依赖。
- `CityService.list/getBySlug` 相应简化（`getBySlug` 的 Top POI 仍按 `Spot.viewCount` DESC，不涉及城市列）。

### D4. DTO 出网白名单

`CitySummary`（`CityDetail` 继承它）出网字段收敛为：
`slug` / `name` / `name_zh` / `cover_image` / `description` / `best_season` / `spot_count`。
- `spot_count` 仍实时聚合（`countByCitySlugAndDeletedFalse`）。
- 移除：`province_zh/en`、`gallery_urls`、`highlights`、`summary_en/zh`、`center_lat/lng`、`view_count`、`post_count`、`featured`。
- `CityDetail` 追加 `top_spots` / `related_posts`（空列表，语义不变）。

### D5. 种子导入：`@Profile("seed")` CommandLineRunner + 幂等跳过

- 新文件 `backend/src/main/java/com/mooc/backend/seed/PlacesSeeder.java`（`ApplicationRunner`，`@Profile("seed")`）。
- 数据源：Java 静态列表（类型安全，10 城市常量 + 每城 2–3 景点常量）；`coverImage` 用 picsum 占位 URL（前端样式规约：占位期统一 picsum，后续换真实图只改 URL）。
- 幂等语义：逐条 `findBySlug(slug)` —— 已存在（含软删）则跳过，不存在则 `City.create(...)` 落库；Spot 同理。第二次执行无新行、无异常（满足 spec Scenario「重复导入不产生重复数据」）。
- slug 均由 `CitySlugs.slugify(name)` / `Slugify(spotName)` 生成；Spot slug 仍为复合 `{citySlug}-{spotSlug}`（spec 要求不透明键，不做分割解析——但 seeder 内部生成时自然拼出）。
- 触发方式：`mvn spring-boot:run "-Dspring-boot.run.profiles=seed"`（或 jar `--spring.profiles.active=seed`）。默认 profile 不加载，避免污染测试与常规启动。
- 备选：`data.sql` —— 弃用：无法按 spec 自动生成 slug；`binary(16)` id 与 JSON 列手写 SQL 易错；`defer-datasource-initialization` 时序坑。

### D6. 前端契约与展示适配

- `City` 类型收敛：`slug`/`name`/`nameZh`/`coverImage`/`description`/`bestSeason`/`spotCount`。
- Spot 反范式字段 `cityNameEn/cityNameZh` → 并入 `cityName`（`City.name` 单值），`ensureCityIndex` 同步；`SpotCard`/`SpotDetail`/`SpotFilters` 改显 `cityName`。
- `listCityOptions` 返回 `{ slug, name, nameZh }`。
- `filterCities` 删除 province/tag/sort 分支：仅 name 升序 + 分页；`listProvinces`/`listCityTags` 删除，`cities/page.tsx` 移除 `CityFilters` 区块与相关 query 解析。
- `getTopCities`：无 `featured` 后按 `name` 升序取前 N（确定性替代）。
- `CityCard`/`CityDetail` 展示：主显 `name`、副标 `nameZh`、正文 `description`、`bestSeason`、`spotCount`、Top POI；删除省份/浏览量/精选徽标/highlights 区块。
- `test/mocks/handlers.ts` `cityToRaw` 与新字段对齐；`CITIES_MOCK` 收敛字段；受影响的 7 个测试同步改（见 tasks）。

## Risks / Trade-offs

- **旧列残留 + NOT NULL 陷阱**：`ddl-auto=update` 只加列不删列，旧 `name_en`(NOT NULL) 等仍留在表上；Hibernate 只写映射列，INSERT 会撞 NOT NULL。`cities` 0 行 → 本地先 `DROP TABLE cities`（无 FK 引用，`spots.city_slug` 为字符串列不受影响），重启后 Hibernate 重建新表。测试环境走 H2 create-drop 无此问题。
- **api-spots 4.7 openapi 收尾挂起**：`openapi.json` 快照未含 places 端点（api-spots 待用户起服同步）。本 change 改 DTO 出网字段，**须在归档前**以运行后端刷新 `openapi.json` + `openapi:gen` + `openapi:drift`，否则快照过期、前端 types 派生漂移。→ Mitigation：把"openapi sync/gen/drift"列为本 change 收尾任务（需后端起 8080），同 api-spots 收尾一起做。
- **首页城市榜排序语义变化**：`featured` 精选被移除后首页 Top N 无策展信号 → 以 `name` 升序替代，属产品接受（spec 已删 featured）；如需人工策展，另开 change 加 `sort_order` 列。
- **描述降级简化**：`description` 单字段后，中文内容直接上英文站点 → 种子内容用英文撰写规避；`project.md` 双语约束对城市 description 的例外已写入 spec delta。
- **大范围前端连带**：Spot 反范式与 7 测试受牵连 → 按 tasks 分块推进，每块跑对应测试。

## Migration Plan

1. 本地 MySQL：`DROP TABLE IF EXISTS wanderchina.cities;`（一次性，0 行）。
2. 后端常规测试（H2 环境，`mvn test`）→ 重启本地后端重建表（MySQL）。
3. 以 `seed` profile 启动一次灌数 → 停服；重启常规后端（无 seed）供前端使用。
4. 前端 `type-check`/`test`/`build` → 起双服务肉眼验证 `/cities`、`/cities/[slug]`、`/spots/[slug]`。
5. 收尾：`openapi:sync`+`openapi:gen`+`openapi:drift` → 提交 backend/frontend submodule → archive。

## Open Questions

无（字段集、seed 范围、排序替代均已与用户确认）。
