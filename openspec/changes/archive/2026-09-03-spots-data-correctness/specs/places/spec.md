## ADDED Requirements

### Requirement: 景点列表与排行榜排序确定性

列表（`GET /api/spots`）与排行榜（`GET /api/spots/ranking`）的排序 SHALL 是**确定性的**：
`ORDER BY` 的业务排序键之后 SHALL 追加一个**唯一且稳定**的 tie-breaker（`slug ASC`）。

- 业务排序键指 `view_count` / `rating` / `hidden_gem` / 收藏聚合数等；
- tie-breaker SHALL 用 `slug`：复合 slug 全局唯一（不会二次并列），且创建后不可变（不随统计更新而变动）；
- 不得使用 `created_at` 作 tie-breaker（同一事务批量导入时多行时间戳相同，不保证唯一）。

确定后的排序 SHALL 为：

```
popular  : view_count DESC, slug ASC
hidden   : hidden_gem DESC, view_count DESC, slug ASC
rating   : rating IS NULL ASC, rating DESC, slug ASC
bookmarks: COALESCE(bookmark_count, 0) DESC, view_count DESC, slug ASC
```

> 动机：排序键在数据集内可能大面积并列（如种子数据 `view_count` 全为 0）。
> MySQL 在 `ORDER BY` 键全等时**不保证返回顺序**，缺少 tie-breaker 会导致
> offset 分页的相邻两页返回重叠行、或永久漏掉某些行——表现为「翻页看到重复卡片」，
> 在无限滚动下表现为「滚动出现重复 / 漏条目」且难以复现。

#### Scenario: 排序键全等时分页不重不漏

- **GIVEN** 数据集中有 5 条 `view_count` 全为 0、`hidden_gem` 全为 false、且 `status=PUBLISHED` 的 Spot
- **WHEN** 以 `size=2` 从 page 1 起逐页取完全部结果
- **THEN** 各页结果并集恰为这 5 条、无重复 slug、不漏任何 slug

#### Scenario: 小众排序键全等时同样确定

- **GIVEN** 数据集中多条 Spot 的 `hidden_gem` 与 `view_count` 均相等
- **WHEN** 以 `sort=hidden` 分页取完全部结果
- **THEN** 各页结果并集无重复、无遗漏

#### Scenario: 排行榜返回顺序可重复

- **GIVEN** 数据集中多条 Spot 的 `rating` 均为 null
- **WHEN** 连续两次调用 `GET /api/spots/ranking?type=rating`
- **THEN** 两次返回的 slug 顺序完全一致

---

## MODIFIED Requirements

### Requirement: 城市与景点种子数据

系统 SHALL 提供**可重复执行**的种子数据导入，向数据库写入首批城市与景点：

- 首批城市 SHALL 覆盖至少 8 个中国主要旅游城市；每个城市 SHALL 配属至少 2 个景点 POI，用于验证「景点归属城市」。
- 导入 SHALL 按 `slug` 幂等：重复执行不产生重复行、不因唯一键冲突失败。
- 城市的 `slug` SHALL 由其 `name` 自动生成，种子数据源不手工提供 `slug`。
- 每个景点的 `citySlug` SHALL 指向一个存在于 `cities` 表的城市（不允许孤儿景点）。
- 城市关键字段（`name` / `nameZh` / `description` / `bestSeason`）与景点可展示字段 SHALL 在导入后非空。
- 种子景点 SHALL 填充 `tags`（每条 2–3 个**跨景点可复用**的标签词）、`rating`、`featured`、`hiddenGem`，
  使依赖这些字段的 UI（卡片评分、标签筛选、`sort=hidden`、首页 `hot-spots` 槽位）可被真实验证。
- 种子景点 SHALL **不**填充 `viewCount`：热度属运行时累积（详情访问 +1）与 `places-ingestion` 爬虫职责，
  种子期编造热度会掩盖「真实热度数据尚未接入」这一事实。排序正确性由
  「景点列表与排行榜排序确定性」Requirement 的 tie-breaker 保证，而非靠假数据。
- 种子数据 SHALL 包含至少一组**同名不同城**的景点（如杭州西湖与福州西湖），
  使「重名 POI 各自可寻址」在真实数据上可验证。

#### Scenario: 重复导入不产生重复数据

- **WHEN** 连续执行两次种子导入
- **THEN** 城市与景点记录数不变，且无唯一键冲突错误

#### Scenario: 景点归属有效

- **WHEN** 种子导入完成
- **THEN** 每条景点的 `citySlug` 均能在 `cities.slug` 中找到对应城市，不存在孤儿景点

#### Scenario: slug 自动生成

- **WHEN** 种子导入写入 `name="Hangzhou"` 的城市
- **THEN** 落库 `slug="hangzhou"`，无需种子数据源提供

#### Scenario: 种子景点可展示字段非空

- **WHEN** 种子导入完成
- **THEN** 每条景点的 `tags` 非空且 `rating` 非 null
- **AND** 存在 `featured=true` 的样本，且存在 `hiddenGem=true` 的样本

#### Scenario: 种子标签可复用

- **WHEN** 种子导入完成
- **THEN** 每个标签词至少被 2 个景点使用（标签筛选器须能筛出多条，不退化成搜索框）

#### Scenario: 种子数据含重名消歧样本

- **WHEN** 种子导入完成
- **THEN** 存在至少一组同名不同城的景点，可分别按其复合 slug 取到且内容不同
