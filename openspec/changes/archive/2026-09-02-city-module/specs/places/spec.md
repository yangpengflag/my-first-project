# places Specification (Delta — city-module)

## MODIFIED Requirements

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

## ADDED Requirements

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
