# Spots List Infinite Scroll — Proposal

## Why

`/spots` 列表页有五个待修问题，其中第 1 条是**欠账**：

1. **无限滚动未交付**：`2026-09-01-spots-frontend-mock`（已归档）的 P2 原文写明
   「列表页 `/cities`、`/spots`（筛选/搜索/分页，**复用无限滚动**）」。
   但后续 `api-spots` / `city-module` 接真实后端时，把 `/spots` 改成了
   Server Component + offset 分页器，无限滚动未落地。
   同期 `/posts` 已由 `2026-08-31-post-list-infinite-scroll` 升级为无限滚动，
   两处公开列表体验不一致。
2. **「无限滚动」若建立在全量拉取上就是假的**：`lib/places/index.ts` 的 `filterSpots()`
   当前一次 `fetchSpots({ size: 1000 })` 拉全量，再在内存里 filter / sort / slice。
   数据量小的时候无害，但由此做出来的滚动是「一次拿完、客户端切块渲染」，
   不是真正的触底续拉，且数据量增长后不可持续。
3. **卡片缺 `tags`**：`SpotCard` 渲染了封面图、评分、城市、中英文名，
   但未渲染 `tags`——而标签是卡片的核心信息之一。
4. **筛选项与真后端数据脱节**（半 mock 状态）：`listCityOptions()` 取 `CITIES_MOCK`、
   `listSpotTags()` 取 `SPOTS_MOCK`（8 城 / 10 景点），而真后端是 10 城 / 22 景点。
   后果是双向的：
   - 下拉里的 **苏州 / 敦煌 / 张家界** → 后端无对应景点，选中后结果必为空；
   - 后端的 **北京 / 上海 / 拉萨 / 广州 / 重庆** → 下拉里根本没有，无法筛选。
5. **前端 mock 与后端种子数据分歧**：`mocks.ts`（8 城 / 10 景点）与 `PlacesSeeder`
   （10 城 / 22 景点）只有 5 个景点交集，且 mock 里的 `fuzhou-west-lake`
   挂在并不存在的 `citySlug: "fuzhou"` 上——真后端会因外键约束拒绝该孤儿景点。

## What Changes

### 1. `/spots` 改为无限滚动 —— SSR 首屏 + 客户端续拉

不使用「纯客户端列表」（`/posts` 的做法），保留 Server Component 渲染首屏：

| | 方案 A 纯客户端（照抄 PostList） | **方案 B SSR 首屏 + 客户端续拉（选用）** |
|---|---|---|
| SEO | ❌ 首屏无内容，景点页是搜索引擎入口 | ✅ 首屏直出 |
| 可分享链接 | ❌ | ✅ `/spots?city=chengdu&sort=hidden` |
| 首屏体验 | ❌ 骨架闪 | ✅ 直出内容 |
| 实现成本 | ✅ 现成可抄 | ⚠️ 两套取数路径，约 2x |

**选 B 的理由**：WanderChina 是对标 Visit Japan 的目的地营销站，
`/spots` 是境外用户搜「things to do in Chengdu」的着陆页，SEO 是核心资产而非可选项。
`/posts` 是 UGC 社区页，两者定位不同，不应机械统一。

实现要点：
- Server Component 取第 1 页直出（沿用现有 `filterSpots`，保留 SEO 与 URL query 驱动）；
- Client 组件接收 `initialItems` / `initialQuery` / `hasMore`，从 `page=2` 起续拉并追加；
- 底部 sentinel 用 `IntersectionObserver`（`rootMargin` 预取）；
- 沿用 `PostList` 已验证的三个细节：`loadingRef` / `hasMoreRef` 镜像 state 防闭包陈旧、
  每次加载后 `unobserve → observe` 同节点强制重判（解决「只翻一页」）、
  空页防御（`list.length > 0 && has_more`，防后端误报导致死循环）；
- 四态齐全：骨架 / 内容 / 空态 / 错误重试（首屏错误与续拉错误分开处理）。

### 2. 改真分页

去掉 `size=1000` 全量拉取，`city` / `category` / `tag` / `q` / `sort` 全部下推给后端
（`GET /api/spots` 已支持全部这些参数，`specs/places` 已定义）。
`lib/places/index.ts` 现有的本地 filter / sort / paginate 逻辑相应退场。

### 3. 卡片渲染 `tags`

- 新增 shadcn `badge` 组件（`components/ui/badge.tsx`）——项目已锁定 shadcn 体系，
  现有 `SpotCard` 用裸 `<span>` 拼 category 徽章，属临时写法，一并收敛到 `Badge`；
- 卡片标签最多显示 3 个，超出显示 `+N`；`tags` 为空时不渲染整行（不占位）。

### 4. 筛选项接真后端

`listCityOptions()` / `listSpotTags()` 改为从 `/api/cities` 与已拉取的景点数据聚合，
消除半 mock 状态。

### 5. mock 对齐真后端

`mocks.ts` 的 `CITIES_MOCK` / `SPOTS_MOCK` 与 `PlacesSeeder` 对齐（10 城 / 22 景点），
使单测跑在与真实形状一致的数据上。移除孤儿 `fuzhou-west-lake`。

> **重名消歧的测试覆盖**因此会消失——真后端种子里没有重名景点。
> 由上游 `spots-data-correctness` 补种「福州 / 福州西湖」恢复该覆盖
> （需同时满足 `specs/places`「每城市至少 2 个景点」，福州配第 2 个景点如三坊七巷）。

### 6. 统一环境变量（方案 B 的专属风险）

`lib/backend.ts` 用 `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"`。
方案 B 意味着同一次页面访问中，请求从**两个环境**发出：

```
SSR 阶段      → 服务端环境变量
hydration 后  → NEXT_PUBLIC_ 构建时内联进 bundle 的值
```

而 `project.md` 记载的 `frontend/.env.local` 写的是 `BACKEND_URL`，
**不是** `NEXT_PUBLIC_API_BASE_URL`。不一致时会出现
「首屏有数据、往下滚全部续拉失败」，且本地（都是 localhost:8080）看不出来，一上 Vercel 就炸。

本 change 须统一为 `NEXT_PUBLIC_API_BASE_URL` 并同步 `.env.local` 约定与 README。

## Capabilities

### New Capabilities

- 无新增 capability。

### Modified Capabilities

- `places`：
  - MODIFIED「景点 REST API」——前端列表页 SHALL 走服务端分页（逐页 `page` / `size`），
    不再一次性拉取全量数据集后本地切片。
  - 新增 Requirement「景点列表页无限滚动」——首屏由 Server Component 直出（保留 SEO
    与可分享 URL），后续页由客户端触底续拉并追加。

## Impact

- **前端**（`frontend/`）：
  - `app/spots/page.tsx`：拆分为 Server 首屏 + Client 续拉组件
  - `components/places/SpotCard.tsx`：渲染 `tags`，category 徽章收敛到 `Badge`
  - `components/ui/badge.tsx`：新增（shadcn）
  - `components/places/Pagination.tsx`：**删除**（无限滚动取代分页器）
  - `lib/places/index.ts`：`filterSpots` 改真分页；`listCityOptions` / `listSpotTags` 接真后端
  - `lib/places/mocks.ts`：对齐 `PlacesSeeder`
  - `test/mocks/handlers.ts`：`/api/spots` handler 须支持 `page` / `size` 切片
    （当前无视 query 返回全量，否则测不出分页）
  - `.env.local` 约定：`BACKEND_URL` → `NEXT_PUBLIC_API_BASE_URL`
- **后端**（`backend/`）：不改动（参数已全部支持）；仅依赖排序确定性。
- **测试**：
  - 需 mock `IntersectionObserver`（沿用 `PostList.test.tsx` 既有做法）
  - `app/spots/page.test.tsx` 断言需更新：现有用例断言 `Mogao Caves`（敦煌，仅 mock 有）
    与两条 `West Lake`（重名消歧，对齐后仅剩一条），mock 对齐后均会失效
  - `npm run openapi:drift` 确认无契约漂移
- **依赖 `spots-data-correctness` 的 tie-breaker**：排序不确定时，客户端续拉会
  拉到重复或漏掉条目——该 change 未完成前本 change 不可开工。

## Dependencies

- **阻塞依赖**：`spots-data-correctness`（排序确定性 tie-breaker + 种子 `tags` / `rating` 补全）。
  没有它：分页会错乱、卡片标签与评分在真实数据下仍不可见。
- 上游：`places` capability spec、`spots-frontend-mock`（已归档，提供现有页面骨架）、
  `api-spots` / `city-module`（已归档，接真实后端）。
- 参照：`post-list-infinite-scroll`（已归档，提供 IntersectionObserver 与四态的成熟实现）。

## Out of Scope

- 景点详情页 `/spots/[slug]` 的字段补全（`lat` / `lng` / `address` 种子数据同样缺失，
  但属详情页范畴，不在本 change）。
- 城市列表页 `/cities` 的同等改造（本 change 只做 `/spots`）。
- 搜索框的防抖与联想（当前为提交式搜索，保持不变）。
