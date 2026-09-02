# city-module — Proposal

## Why

`api-spots`（P4）已交付 City/Spot 的只读 REST API 与前端接入，但**数据库里没有任何城市/景点数据**（`cities`、`spots` 均 0 行），列表与详情页全是空态，且景点与城市的归属关系（`city_slug`）无处可验证。

同时业务方重新定义城市字段集：只需 `name`（英文，必填）/ `nameZh` / `coverImage` / `description`（单字段，不区分中英）/ `bestSeason`。现有 `places` spec 中的 City 模型（双语 `nameEn/nameZh`、`summaryEn/Zh`、省份、坐标、`featured`、图集等 21 列）超出当前业务心智。`cities` 表当前 0 行，是**唯一一次改 schema 免迁移的窗口**。

数据来源按产品决策先走**脚本导入**（AI 爬虫属后续 `places-ingestion` P5 范围）。

## What Changes

- **BREAKING** City 字段精简（表结构重构）：
  - `name_en` → `name`（英文名，NOT NULL，主显）；`name_zh` 保留。
  - `summary_en` + `summary_zh` → `description`（单字段 TEXT，不区分语言）。
  - `cover_image_url` → `cover_image`；`best_season` 保留。
  - `slug` **保留**（UNIQUE，`spots.city_slug` 与前端路由依赖），改由 `name` 自动 kebab-case 生成，不再手工维护。
  - 移除列：`province_zh` / `province_en` / `gallery_urls` / `highlights` / `center_lat` / `center_lng` / `view_count` / `featured`。
- **BREAKING** `GET /api/cities` 移除 `province` / `tag` / `sort` 查询参数（列表按 `name` 升序 + page/size 分页）；`GET /api/cities/{slug}` 移除详情访问计数与 Top POI 仍保留但图集字段消失。
- **BREAKING** `ViewCountService` 移除城市计数分支（`view_count` 列删除）；Spot 计数保留（Spot schema 不动）。
- **BREAKING** 前端 `City` 契约类型、映射层、选择器与页面同步适配：`nameEn`→`name`、`summaryEn/summaryZh`→`description`；`CityFilters` 省份/标签筛选下拉移除；首页城市榜排序改为 `name` 升序。
- 新增**种子数据导入机制**：幂等（按 `slug` upsert），导入首批城市与景点数据。
- 首批种子：约 10 个主要旅游城市（北京/上海/西安/成都/杭州/桂林/拉萨/丽江/广州/重庆），每个城市配 2–3 个景点，验证「景点归属城市」。

## Capabilities

### New Capabilities

无（不引入新 capability）。

### Modified Capabilities

- `places`: City 数据模型字段精简（**BREAKING**：`nameEn/nameZh/summaryEn/summaryZh/coverImageUrl/gallery/province/highlights/center/featured/viewCount` → `name/nameZh/coverImage/description/bestSeason/slug`）；城市列表 API 参数与默认排序变更；新增「城市/景点种子数据」Requirement（首批城市 + 景点、按 slug 幂等 upsert、自动生成 slug）。

## Impact

- `backend/` submodule：`places/domain/City.java`、`CitySummary`/`CityDetail` DTO、`CityService`、`CityRepository(+Impl)`、`CitiesController`、`ViewCountService`、新增种子导入器与种子数据源、`CityRepositoryTest`/`PlacesApiTest` 等测试。
- `frontend/` submodule：`lib/places/types.ts`、`client.ts`、`index.ts`、`app/cities/page.tsx`、`components/places/CityCard`/`CityFilters`/`EmptyState`、`app/regions/CityGridSlot.tsx`、`app/cities/[slug]/page.tsx` 及 `CityDetail` 相关组件与测试。
- 本地 MySQL `wanderchina`：`cities` 表结构变化（0 行，`ddl-auto=update` 免迁移）；`spots` 表结构不变但首次灌入数据。
- Specs：`openspec/specs/places/spec.md` 的 City Requirement 与相关 Scenario 改写/删除。
