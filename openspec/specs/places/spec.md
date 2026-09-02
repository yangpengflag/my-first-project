# places Specification

## Purpose

为境外游客（WanderChina）提供中国**城市目的地**与**具体景点 POI** 的探索能力：两层嵌套的领域模型、双语（英文主显、中文地名副显）内容、重名消歧，以及景点/城市页对旅行攻略（Post）的地点聚合。数据前期由前端 mock 驱动，后期由后端 `api-spots` + `places-ingestion`（AI 爬虫定时采集英译）接入。

本 capability 取代 `openspec/notes/homepage/homepage-hot-spots.md` 的窄首页卡片规划，并填充 `homepage-shell` 的 `city-grid` / `hot-spots` 槽位。
## Requirements
### Requirement: 城市目的地数据模型（City）

系统 SHALL 以 `City` 实体持久化城市目的地。字段契约（REST 出网 snake_case）：

- `name`：城市英文名，**必填**，全表唯一（也是 `slug` 的唯一生成源），主显。
- `nameZh`：城市中文名，作为副标展示（如主显 `Hangzhou` 的副标 `杭州`）。
- `slug`：唯一字符串，由 `name` 自动 kebab-case 生成（如 `name="Hangzhou"` → `slug="hangzhou"`），全表唯一，为不透明路由键与归属锚点：`spots.city_slug`、`/cities/{slug}` 路由依赖它，**系统 SHALL NOT 对 slug 做中英之外的自定义解析**。
- `coverImage`：封面图 URL（可空）。
- `description`：**单字段**描述，不区分语言 —— 用户/数据源输入什么即持久化与展示什么，不做中英拆分、不做缺失降级。
- `bestSeason`：可选最佳季节（如 `"March–May"`）。
- `spotCount` / `postCount`：下属 POI 数 / 关联攻略数（聚合查询产物，不冗余存储；`postCount` 依赖 `post-location-tagging`，落地前为 0）。

> 已移除：`provinceZh/provinceEn`、`gallery`、`summaryEn/summaryZh`、`highlights`、`centerLat/centerLng`、`viewCount`、`featured` —— 城市不再有省份/图集/双语摘要/坐标/浏览量/精选标记。

#### Scenario: 城市双语渲染

- **WHEN** 渲染 `/cities/hangzhou`
- **THEN** 页面主显 `Hangzhou`（`name`），副标 `杭州`（`nameZh`）

#### Scenario: slug 唯一约束

- **WHEN** 写入两个 `name` 相同的城市（从而自动生成的 `slug` 也相同）
- **THEN** 第二次写入被拒（唯一约束冲突）；`slug` SHALL 由 `name` 自动生成，调用方无需手工提供

#### Scenario: description 原样保存与展示

- **WHEN** 某城市的 `description` 输入为一段混合语言文本
- **THEN** 系统原样持久化并在详情/列表展示该文本，不按语言拆分、不补齐任何翻译

---

### Requirement: 景点 POI 数据模型（Spot）

系统 SHALL 以 `Spot` 实体持久化具体可游览 POI，字段契约：
- `slug`：复合 `citySlug-spotSlug`（如 `hangzhou-west-lake`），**全局唯一**（复合 slug 仅作不透明路由键，系统 SHALL NOT 对其做分割解析）。
- `nameZh` / `nameEn`：`nameEn` 主显。
- `citySlug`：所属城市 slug（归属 + 消歧）。
- `category`：枚举，取值域 `nature` / `culture` / `history` / `food` / `district` / `leisure`；展示文案通过双语 label 映射（如 `nature → 自然 / Nature`）。
- `tags`：`string[]`（世界遗产/亲子/出片/免费…）。
- `level`：可选 `5A` / `4A` / `null`。
- `addressEn` / `addressZh` / `lat` / `lng`：地址与坐标。
- `coverImage` / `gallery`：封面与图集。
- `summaryEn` / `summaryZh` / `descriptionEn` / `descriptionZh`：短介与富文本（英主中副）。
- `openingHours` / `ticketInfo` / `visitDuration`：可选实用信息。
- `viewCount` / `postCount`：浏览量、关联攻略数（聚合查询；`viewCount` 累加机制见 `api-spots` change）。
- `rating`：**可选** `number`（0–5），由 AI 爬虫估算产出，可空；本期**无评价/评论系统**，字段缺失时 UI SHALL NOT 展示评分。
- `featured`：布尔，编辑/爬虫置信精选，驱动首页 `hot-spots` Top N（与 `viewCount` 排名正交）。
- `hiddenGem`：布尔，标记 off-the-beaten-path / 小众深度体验（对应 `project.md` 的 Hidden Spot 语义）。

> 本期 Spot **不包含** `bookmarkCount` 等收藏统计：收藏是 post 专属能力（`post_bookmarks`），Spot 收藏需独立子系统，不在本 capability 范围内（如有需要另起 change）。

#### Scenario: 重名 POI 各自可寻址

- **GIVEN** 杭州与福州各有一个「西湖 / West Lake」
- **WHEN** 访问 `/spots/hangzhou-west-lake` 与 `/spots/fuzhou-west-lake`
- **THEN** 两者分别返回对应城市的 POI，URL 与 slug 互不冲突

#### Scenario: 展示强制带城市后缀

- **WHEN** 任意 POI 卡片/标题渲染
- **THEN** 文案含 `nameZh + nameEn + 城市名`（如 `西湖 West Lake · Hangzhou`），即便同名也不混淆

#### Scenario: 评分缺失不渲染

- **WHEN** 某 POI 的 `rating` 为 `null`
- **THEN** 详情页不展示评分区块，不占位

#### Scenario: 首页 hot-spots 展示小众精选

- **GIVEN** 存在若干 `hiddenGem=true` 与 `featured=true` 的 Spot
- **WHEN** 首页 `HotSpotsSlot` 渲染 Top N
- **THEN** 优先取 `hiddenGem=true` 的 Spot；不足 N 时以 `featured=true` 补足；纯 `viewCount` 热门不作为首要排序依据（契合 project.md 的 Hidden Spot 定义）

#### Scenario: 列表页支持热门/小众两种排序

- **WHEN** `/spots?sort=hidden`
- **THEN** 结果优先 `hiddenGem=true`，其次按 `viewCount` 降序
- **WHEN** `/spots?sort=popular`（默认）
- **THEN** 结果按 `viewCount` 降序

---

### Requirement: 景点-城市嵌套与重名消歧

`Spot` SHALL 通过 `citySlug` 归属唯一 `City`（多 Spot 对一 City）。重名消歧 SHALL 由**复合 slug** 与**展示城市后缀**双重保障：
- 复合 slug `{citySlug}-{spotSlug}` 全局唯一，从根避免重名碰撞。
- 任何 UI 展示 POI 名称时 SHALL 附带城市名。

#### Scenario: 缺失 citySlug 的 POI 被拒

- **WHEN** 写入 `citySlug` 为空或指向不存在城市的 Spot
- **THEN** 写入被拒（外键/非空约束）

---

### Requirement: 双语内容策略

「英文为主、中文为辅」SHALL 适用于 **Spot** 与**城市名主副显**：`nameEn`（或城市 `name`）主显、`nameZh` 副标。

城市 `description` MUST 是**单一语言字段**（见 City 数据模型），不参与双语拆分或缺失降级逻辑。

#### Scenario: 英文缺失时降级

- **WHEN** 某 Spot 的 `descriptionEn` 为空（采集未完成）
- **THEN** 详情页以 `descriptionZh` 兜底展示并标记待翻译，不渲染空白区块

---

### Requirement: 景点/城市 REST API

系统 SHALL 提供如下只读端点（snake_case 命名）：

- `GET /api/cities?page=&size=` → `CitySummary[]`，列表**按 `name` 升序**分页（不再支持 `province` / `tag` / `sort` 参数）。
- `GET /api/cities/{slug}` → `CityDetail`（含 `spotCount`、Top POI、相关攻略引用）。
- `GET /api/spots?city=&category=&tag=&q=&sort=popular&page=&size=` → `SpotSummary[]`（不变）。
- `GET /api/spots/{slug}` → `SpotDetail`（gallery、info、相关攻略、周边 POI）（不变）。

分页 SHALL 复用既有 `PostListParams` 模式（offset + `total`）。

#### Scenario: 城市列表默认排序

- **WHEN** `GET /api/cities`（不带任何筛选/排序参数）
- **THEN** 返回按 `name` 升序分页的全部存活城市，无 `viewCount` 概念

#### Scenario: 按城市筛选景点

- **WHEN** `GET /api/spots?city=hangzhou&category=history`
- **THEN** 仅返回 `citySlug=hangzhou` 且 `category=history` 的 POI，按 `viewCount` 降序分页

#### Scenario: 未知 slug 返回 404

- **WHEN** `GET /api/cities/{slug}` 或 `GET /api/spots/{slug}` 的 slug 不存在
- **THEN** 返回 `404`，`error.code` 分别为 `"CITY_NOT_FOUND"` / `"SPOT_NOT_FOUND"`

---

### Requirement: 城市与景点种子数据

系统 SHALL 提供**可重复执行**的种子数据导入，向数据库写入首批城市与景点：

- 首批城市 SHALL 覆盖至少 8 个中国主要旅游城市；每个城市 SHALL 配属至少 2 个景点 POI，用于验证「景点归属城市」。
- 导入 SHALL 按 `slug` 幂等：重复执行不产生重复行、不因唯一键冲突失败。
- 城市的 `slug` SHALL 由其 `name` 自动生成，种子数据源不手工提供 `slug`。
- 每个景点的 `citySlug` SHALL 指向一个存在于 `cities` 表的城市（不允许孤儿景点）。
- 城市关键字段（`name` / `nameZh` / `description` / `bestSeason`）与景点可展示字段 SHALL 在导入后非空。

#### Scenario: 重复导入不产生重复数据

- **WHEN** 连续执行两次种子导入
- **THEN** 城市与景点记录数不变，且无唯一键冲突错误

#### Scenario: 景点归属有效

- **WHEN** 种子导入完成
- **THEN** 每条景点的 `citySlug` 均能在 `cities.slug` 中找到对应城市，不存在孤儿景点

#### Scenario: slug 自动生成

- **WHEN** 种子导入写入 `name="Hangzhou"` 的城市
- **THEN** 落库 `slug="hangzhou"`，无需种子数据源提供

---

## Cross-capability dependencies

### Post 地点关联（`post-location-tagging`，未落地）

- `posts` 实体 SHALL 增量可选 `city_id`（单城市语境）与 `spot_ids`（`string[]`，多 POI）；`city_id` 存城市 slug，`spot_ids` 存 Spot 复合 slug。
- `GET /api/cities/{slug}` 与 `GET /api/spots/{slug}` 的 `related_posts` / `postCount` 依赖该能力；其落地前分别为**空列表 / 0**（相关 Requirement 的 Scenario 已按此定义）。
- 落地后由 post-location-tagging change 增量更新 `posts` spec，并通过 `POST /api/posts` 接受可选 `city_id` / `spot_ids`、`GET /api/posts` 支持 `cityId` / `spotId` 过滤。

