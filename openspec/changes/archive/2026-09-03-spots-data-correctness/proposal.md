# Spots Data Correctness — Proposal

## Why

`GET /api/spots` 的列表体验同时依赖「排序」与「分页」两条正确性保证，而当前两者都建立在已失效的前提上。

实测本地库（`wanderchina.spots`，22 条 PUBLISHED）：

| 指标 | 实测 | 直接后果 |
|---|---|---|
| `view_count = 0` | 21 / 22 | 排序键几乎全并列 |
| `rating IS NULL` | 22 / 22 | 卡片评分区一个都不渲染 |
| `tags` 为空 | 22 / 22 | 卡片无标签 + 标签筛选器 100% 失效 |
| `featured` 为 true | 0 / 22 | 首页 hot-spots 槽位无内容可选 |
| `hidden_gem` 为 true | 0 / 22 | `sort=hidden` 退化为按 view_count 排序 |

四个具体问题：

1. **分页结果不确定（正确性 bug，最高优先级）**：`SpotRepositoryImpl.search()` 的排序为
   `ORDER BY s.view_count DESC`（popular）与 `ORDER BY s.hidden_gem DESC, s.view_count DESC`（hidden），
   **均无 tie-breaker**。MySQL 在排序键全等时不保证返回顺序，故 offset 分页的相邻两页
   可能返回重叠行、或永久漏掉某些行。当前分页器下表现为「翻页看到重复卡片」；
   改为无限滚动后表现为「滚动出现重复 / 漏条目」，且难以复现与回归。
2. **排序信号全空**：`hidden_gem` 全 false 使 `sort=hidden` 退化，而次级键 `view_count` 21/22 为 0，
   排序实质失效；`featured` 全 false 使首页 hot-spots 槽位无内容可选。
3. **卡片可展示字段为空**：按 `specs/places`「rating 缺失时 UI SHALL NOT 展示评分」，
   22/22 为 null 意味着评分区零渲染；`JSON_CONTAINS(s.tags, :tagJson)` 在空数组上永不命中，
   标签筛选器选中任何标签结果都为空。
4. **同类问题未全覆盖**：`ranking()` 的 `bookmarks` 分支**已有** tie-breaker
   （`ORDER BY COALESCE(b.cnt, 0) DESC, s.view_count DESC`，注释明写「保证结果确定」），
   但 `rating` / `popular` 分支缺失——同一个坑只填了一半。

> **本 change 是 `spots-list-infinite-scroll` 的前置阻塞项**：不修 tie-breaker，
> 无限滚动滚出来的列表就是错的。

## What Changes

- **后端 `SpotRepositoryImpl.search()`：补确定性 tie-breaker**
  - `popular`：`ORDER BY s.view_count DESC, s.slug ASC`
  - `hidden`：`ORDER BY s.hidden_gem DESC, s.view_count DESC, s.slug ASC`
- **后端 `SpotRepositoryImpl.ranking()`：补齐缺失的 tie-breaker**
  - `popular`：`ORDER BY s.view_count DESC, s.slug ASC`
  - `rating`：`ORDER BY s.rating IS NULL ASC, s.rating DESC, s.slug ASC`
  - `bookmarks`：末端追加 `, s.slug ASC`（现有 `s.view_count DESC` 保留为次级排序）
- **后端 `PlacesSeeder`：为 22 个种子景点补可展示字段**
  - `SpotSeed` record 新增 `tags` / `rating` / `featured` / `hiddenGem` 四个字段并逐条填充。
  - 使列表卡片（评分、标签）、标签筛选器、`sort=hidden`、首页 hot-spots 槽位均有真实内容可渲染。
- **不改 `view_count`**：热度仍由运行时累积（详情访问 +1）与 `places-ingestion` 爬虫填充。
  种子期**不编造热度**——排序正确性由 tie-breaker 保证，而非靠假数据掩盖「爬虫尚未落地」这一事实。

### 为什么用 slug 作 tie-breaker

`slug` 是复合 slug（`{citySlug}-{spotSlug}`）且**全局唯一**，满足确定性排序的两个条件：
值唯一（不会出现二次并列）、值稳定（不随行更新或统计变化而变动）。
`id` 为 `binary(16)` 随机 UUID，虽也唯一但无语义；`created_at` 在同一事务批量导入时可能并列，
均不如 `slug` 稳妥。

## Capabilities

### New Capabilities

- 无新增 capability。

### Modified Capabilities

- `places`：
  - MODIFIED「景点 POI 数据模型（Spot）」——新增「列表与排行榜排序必须确定性（含唯一 tie-breaker）」约束。
  - MODIFIED「城市与景点种子数据」——种子景点 SHALL 填充 `tags` / `rating` / `featured` / `hiddenGem`，
    使依赖这些字段的 UI（卡片评分、标签筛选、小众排序、首页精选槽位）可被验证。

## Impact

- **后端**（`backend/`）：
  - `places/repository/SpotRepositoryImpl.java`：`search` / `ranking` 的 ORDER BY。
  - `places/seed/PlacesSeeder.java`：`SpotSeed` record 扩展 + 22 条数据填充。
  - 测试：`SpotRepositoryTest` 增补分页确定性与排行榜稳定性断言；`PlacesSeederTest` 增补字段非空断言。
- **前端**（`frontend/`）：不改动。
- **契约**：无字段 / 端点变更，`openapi:sync` 与 `openapi:gen` 无需重跑；仍跑 `openapi:drift` 确认无漂移。
- **数据（一次性运维）**：`seedSpot` 为幂等跳过语义（`findBySlug(...).isPresent()` 即 return），
  故**改完 seeder 重启不会更新既有 22 行**。需先清空 `spots` 表再以 `seed` profile 启动，见 `design.md` R1。

## Dependencies

- 上游：`places` capability spec（字段契约）、`spot-module-backend`（已归档，提供 `search` / `ranking` / `PlacesSeeder`）。
- 下游：`spots-list-infinite-scroll`（列表页无限滚动）——**被本 change 阻塞**。
- 相关但不在本 change：`places-ingestion`（AI 爬虫，将填充真实 `view_count` 与翻译字段）。
