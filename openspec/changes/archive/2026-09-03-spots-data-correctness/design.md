# Design — spots-data-correctness

## Decisions

### D1. tie-breaker 选型：`slug`

待选项与淘汰理由：

| 候选 | 唯一 | 稳定 | 结论 |
|---|---|---|---|
| `s.slug` | ✅ 全局唯一（复合 slug） | ✅ 创建后不可变 | **选用** |
| `s.id` | ✅ UUID | ✅ | 淘汰：`binary(16)` 随机值，无语义、日志难读、无法人工预测期望顺序 |
| `s.created_at` | ❌ 批量导入同事务内并列 | ✅ | 淘汰：种子导入时多行时间戳相同，不能保证唯一 |

实现要点：`slug` 已在 `spots` 表上带唯一索引，追加进 ORDER BY 不额外增加索引成本
（MySQL 仍走 `view_count` 排序 + filesort，数据量在万级以内无性能顾虑）。

顺序固定为 **业务排序键在前、`slug` 在最后**：

```
popular  : view_count DESC, slug ASC
hidden   : hidden_gem DESC, view_count DESC, slug ASC
rating   : rating IS NULL ASC, rating DESC, slug ASC
bookmarks: COALESCE(b.cnt,0) DESC, view_count DESC, slug ASC
```

> `rating` 分支保留 MySQL 专有写法 `rating IS NULL ASC` 把无评分沉底
> （MySQL 不支持 `NULLS LAST`），`slug` 追加在其后。

### D2. 不编造 `view_count`

种子期给 22 条景点编一个热度值，能让「最热门」排序立刻看起来正常，但代价是：

- 掩盖「`places-ingestion` 爬虫尚未落地、真实热度数据缺失」这一事实；
- 制造假信号——`featured` / `hiddenGem` 是**编辑判断**，人工给合理；
  `view_count` 是**自然累积**，人工给就是编数据。

故本 change 只补「编辑判断类」字段（`tags` / `rating` / `featured` / `hiddenGem`），
`view_count` 保持 0，排序正确性由 D1 的 tie-breaker 保证。

排序键全为 0 时，列表退化为按 `slug` 字母序——**稳定、不重、不漏**，
这是分页正确性所需的最低保证，而非产品终态。真实热度由爬虫接入后自然生效。

### D3. 种子字段填充原则

`tags`（每景点 2–3 个）：只使用**跨景点可复用**的标签词，保证标签筛选器能筛出多条结果。
避免每景点一个独有标签（那样筛选器等价于搜索框）。建议词表：
`UNESCO` / `Must-see` / `Free` / `Photo` / `Family` / `Hiking` / `Food` / `Temple` /
`Museum` / `Old Town` / `Night View` / `Cable Car`。

`rating`（4.0–4.9，一位小数）：按景点知名度给梯度，避免全给 4.5 导致排名并列无区分度。

`featured`（建议 6–8 条）：城市标志性景点——故宫、兵马俑、西湖、熊猫基地、布达拉宫、外滩、漓江。

`hiddenGem`（建议 5–7 条）：相对小众、非旅行团主线——芦笛岩、天坛、大昭寺、磁器口、武侯祠、灵隐寺。

> `featured` 与 `hiddenGem` **允许重叠**（语义正交：精选 vs 小众），
> 但至少保证每条各有独立样本，以便 `HotSpotsSlot` 的「hiddenGem 优先、featured 补足」逻辑可被验证。

## Risks

### R1. 幂等导入会跳过既有行，新增字段不会落库（必读）

`PlacesSeeder.seedSpot()` 为幂等跳过语义：

```java
if (spotRepository.findBySlug(spotSlug).isPresent()) {
    return;   // ← 已存在即跳过，不更新
}
```

而本地库已有 22 行。故**改完 seeder 直接重启，字段仍是旧值**。

处理方式（一次性运维，任选其一）：

1. **清空重灌**（推荐，本库为纯演示数据）：
   ```sql
   DELETE FROM wanderchina.spots;
   ```
   再以 `seed` profile 启动。城市行可保留（本次不改城市字段），`cities` 无需动。
2. 改 `seedSpot` 为 upsert——**不采用**：会让 seeder 承担「部分更新」语义，
   与 spec 的「按 slug 幂等、重复执行不产生重复行」约束相悖，且为一次性需求引入长期复杂度。

验证：`SELECT slug, rating, tags, featured, hidden_gem FROM spots LIMIT 5;`
确认 `rating` 非 null、`tags` 非空。

### R2. 测试跑真实 MySQL（非 H2）——验证链的前置条件

`backend/src/main/resources/application.yml` 的 `spring.datasource.url` 指向
`jdbc:mysql://localhost:3306/wanderchina`，且 `SpotRepositoryTest` 为
`@SpringBootTest @Transactional`（无 `@ActiveProfiles`、无 test 侧数据源覆盖）——
**测试直接跑在真实库上，靠事务回滚隔离数据**。

影响（两面）：

- ✅ **好消息**：`JSON_CONTAINS(s.tags, :tagJson)` 是 MySQL 专有函数。测试跑 MySQL
  意味着 tag 过滤分支**可被自动化测试真实覆盖**；若跑 H2 则该分支根本无法执行。
  本 change 的 tie-breaker 与种子 `tags` 因此都能得到真实验证，不依赖手工 SQL。
- ⚠️ **约束**：跑 `mvn test` 前须确认
  1. MySQL 服务在运行；
  2. 8080 端口未被 `dev` 后端占用（`@SpringBootTest` 会起 Web 环境）；
  3. `wanderchina` 库未被其他连接锁住。
- 沿用 `PostRepositoryTest` 既有模式：`@BeforeEach` 清空相关表 + `@Transactional` 回滚，
  保证不破坏真实数据。

### R3. 全量 `mvn test` 的历史红灯（与本 change 无关，但会干扰判断）

既有 `auth` 相关集成测试在并发下会触发 QQ SMTP 频控（535），且
`frontend/components/auth/auth-forms.test.tsx` 有 6 个既存失败。
本 change 的验收**只看 `SpotRepositoryTest` / `PlacesSeederTest` / `SpotsRankingApiTest` 绿**，
不要求全量 `mvn test` 无红——避免被无关红灯误导。

## 复用与约束

- 排序字符串拼接沿用 `SpotRepositoryImpl` 现有写法（`String order = ...` 局部变量），
  不引入 Criteria API / Specification 等新抽象（YAGNI）。
- `PlacesSeeder` 仅在 `seed` profile 下注册（`@Profile("seed")`），常规启动与测试不加载，改动无副作用。
- `Spot.create(...)` 签名**不变**：`tags` / `rating` / `featured` / `hiddenGem` 本就在参数列表中，
  当前只是被 seeder 传了 `List.of()` / `null` / `false` / `false`，本次仅改调用侧实参。
