## ADDED Requirements

### Requirement: 景点列表页无限滚动

`GET /spots` 列表页 SHALL 采用「**SSR 首屏 + 客户端续拉**」的无限滚动形态：

- 首屏（第 1 页）SHALL 由 Server Component 直出，保留 SEO 与可分享 URL（`/spots?city=&category=&tag=&q=&sort=`）。
  > 理由：本产品对标国际目的地营销站，`/spots` 是境外用户通过搜索引擎进入的着陆页，
  > SEO 与可分享链接是核心资产，不得为交互一致性而牺牲。
- 后续页 SHALL 由客户端在 sentinel 触底（`IntersectionObserver`，带 `rootMargin` 预取）时，
  按 `page` / `size` 续拉并**追加**到既有列表。
- 前端 SHALL 走**服务端分页**（逐页 `page` / `size`），
  SHALL NOT 一次性拉取全量数据集后在本地 filter / sort / slice。
- 筛选条件（`city` / `category` / `tag` / `q` / `sort`）任一变化 SHALL 清空列表并从第 1 页重新加载，
  不得把旧筛选结果追加到新结果之后。
- 四态 SHALL 齐全：加载骨架 / 内容 / 空态（引导文案 + CTA）/ 错误（错误描述 + 重试）。
  首屏错误与续拉错误 SHALL 分开处理——续拉失败不得丢失已加载内容。
- 列表顺序的正确性依赖 `places` 的「景点列表与排行榜排序确定性」Requirement：
  排序不确定时，续拉会产生重复或遗漏条目。

#### Scenario: 首屏直出可供索引与分享

- **WHEN** 请求 `/spots?city=chengdu&sort=hidden`
- **THEN** 服务端直出第 1 页 HTML（无需执行客户端 JS 即可获得卡片内容）
- **AND** 该 URL 可直接分享并复现同样的筛选结果

#### Scenario: 触底续拉追加下一页

- **GIVEN** 首屏已渲染 6 条景点且 `has_more=true`
- **WHEN** 用户滚动至底部 sentinel 进入视口
- **THEN** 自动请求 `page=2` 并将结果追加到列表末尾，已加载内容不重新渲染

#### Scenario: 筛选变化重置列表

- **GIVEN** 用户已滚动加载了 3 页结果
- **WHEN** 用户切换城市筛选
- **THEN** 列表被清空并从 `page=1` 重新加载，不残留上一个筛选条件下的条目

#### Scenario: 续拉失败保留已加载内容

- **GIVEN** 首屏已渲染内容
- **WHEN** 触底续拉请求失败
- **THEN** 已加载的列表保持不变，底部展示错误描述与「重试」操作

#### Scenario: 加载完毕提示到底

- **WHEN** 续拉返回的 `has_more=false` 且列表非空
- **THEN** 底部展示「已经到底啦」提示，并停止后续触底请求

#### Scenario: 空结果展示引导

- **WHEN** 筛选后第 1 页结果为空
- **THEN** 展示居中图标 + 引导文案 + 清空筛选的 CTA，不展示空白网格

---

### Requirement: 景点卡片信息完整性

景点卡片（列表页与首页 `hot-spots` 槽位共用 `SpotCard`）SHALL 渲染：
封面图、`rating`（可空）、城市位置、`nameEn`（主显）与 `nameZh`（副标）、`tags`。

- `rating` 为 `null` 时 SHALL NOT 渲染评分区，且**不占位**（沿用「评分缺失不渲染」约束）。
- `tags` SHALL 渲染，最多展示 3 个，超出部分折叠为 `+N`；`tags` 为空数组时 SHALL NOT 渲染整行，不占位。
- 封面图缺失时 SHALL 使用渐变占位（`bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100`）
  加居中图标兜底，不出现白块。

#### Scenario: 卡片渲染评分与标签

- **GIVEN** 某景点 `rating=4.7`、`tags=["UNESCO","Free","Photo","Family"]`
- **WHEN** 渲染该景点卡片
- **THEN** 显示评分 `4.7`，显示前 3 个标签，第 4 个折叠为 `+1`

#### Scenario: 标签为空时不渲染

- **GIVEN** 某景点 `tags=[]`
- **WHEN** 渲染该景点卡片
- **THEN** 不渲染标签行，且不留下空白间距
