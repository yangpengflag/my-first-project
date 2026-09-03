# Design — spots-list-infinite-scroll

## 前提

本 change **被 `spots-data-correctness` 阻塞**：后端排序若不具确定性，客户端续拉会拉到重复
或漏掉条目。开工前先确认该 change 已归档。

---

## Decisions

### D1. 组件拆分：Server 首屏 + Client 续拉

```
app/spots/page.tsx  (Server Component, force-dynamic)
  │
  ├─ 解析 searchParams → { city, category, tag, q, sort, page }
  ├─ filterSpots({ ...query, page, size })   ← 真分页，只取当前页
  ├─ listCityOptions() / listSpotTags()      ← 改为接真后端
  │
  ├─ <SpotFilters .../>                       (client, 改写 URL query)
  │
  └─ <SpotInfiniteList                        (client)
        key={queryKey}          ← 筛选变化时强制 remount
        initialItems={items}
        initialQuery={query}
        initialHasMore={hasMore}
        initialPage={page}
      />

components/places/SpotInfiniteList.tsx  ("use client")
  ├─ state : items / page / hasMore / loadingMore / loadMoreError
  ├─ refs  : loadingRef / hasMoreRef / sentinelRef / ioRef / queryRef
  ├─ useEffect → IntersectionObserver(sentinel) → loadMore()
  └─ render: 网格 + 加载更多骨架 + 续拉错误重试 + 「已经到底啦」+ sentinel
```

**关键机制：`key={queryKey}` 强制 remount。**

筛选变化 → `SpotFilters` 调 `router.replace(..., { scroll: false })` → App Router 重新请求
Server Component → page.tsx 返回**新筛选条件下的第 1 页** → `key` 变化 →
`SpotInfiniteList` 重新挂载并直接采用新的 `initialItems`。

这带来三个好处：

1. 客户端**不需要**为筛选变化重新 fetch 第 1 页（server 已算好），省一次请求；
2. state 天然重置，不存在「旧筛选结果被追加到新结果之后」的经典 bug；
3. 无需在 client 里同步 URL query 与内部 state 两套真源。

`queryKey` 用 `JSON.stringify(query)` 或拼串（如 `${city}|${category}|${tag}|${q}|${sort}`）。

### D2. 续拉的数据源

client 续拉直接复用 `lib/places/client.ts` 的 `fetchSpots({ ...query, page: N, size })`，
不新造 fetch 栈（DRY：`fetchFromBackend` 已处理 Bearer 注入 / 401 续期重放 / 错误信封解析）。

已知代价：`fetchSpots` 内部调 `ensureCityIndex()` 拉一次 `/api/cities` 建城市名索引。
SSR 阶段的模块级缓存不会带到浏览器，故客户端首次续拉会**多一次 `/api/cities` 请求**
（之后缓存命中）。当前量级可接受，不为此引入额外抽象（YAGNI）。

### D3. 真分页：`filterSpots` 退化为薄门面

现状（`lib/places/index.ts`）：

```ts
const { items } = await fetchSpots({ size: 1000 });   // 拉全量
// 然后本地 filter / sort / paginate
```

改为：

```ts
export async function filterSpots(query: SpotQuery = {}): Promise<PageResult<Spot>> {
  return fetchSpots(query);   // city / category / tag / q / sort / page / size 全下推后端
}
```

保留 `filterSpots` 这个名字而非直接让页面调 `fetchSpots`，是为了：

- 页面与既有测试（`app/spots/page.test.tsx`、`lib/places/selectors.test.ts`）的调用方式不变，
  本次改动只需调整**数据断言**，不必重写测试结构；
- 后续若需要「服务端能力不足时的本地兜底」，有且只有一个挂载点。

本地 `filter` / `sort` / `paginate` 三个内部函数相应删除（`paginate` 若被 `filterCities`
复用则保留给城市页——城市列表页本次不改）。

### D4. 环境变量统一（方案 B 的专属风险，必做）

`lib/backend.ts`：

```ts
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
```

方案 B 下，同一次页面访问的请求来自两个环境：

```
SSR 阶段      → 服务端环境变量（运行时可改）
hydration 后  → NEXT_PUBLIC_* 在 build 时内联进 bundle（运行时不可改）
```

而 `project.md` 记载的 `frontend/.env.local` 写的是 `BACKEND_URL`，**并非**
`NEXT_PUBLIC_API_BASE_URL`。不一致时的故障表现是
「首屏正常、往下滚全部续拉失败」，且**本地开发看不出来**（两边都是 `localhost:8080`），
一部署到 Vercel 才暴露。

处理：

- 统一使用 `NEXT_PUBLIC_API_BASE_URL`，更新 `frontend/README.md` 的 `.env.local` 示例；
- `frontend/.env.local.example`（若不存在则新增）同步，避免下一个人再踩。

### D5. SEO：保留爬虫可达性

无限滚动的固有代价是「爬虫拿不到第 1 页之后的内容」。本 change 采用最小补偿：

- Server 端保留 `?page=N` 的直出能力（本来就有，不删）；
- 列表底部 sentinel 上方放一个**视觉隐藏但对爬虫可见**的 `<Link rel="next" href="?page=N+1">`，
  使搜索引擎能顺链发现后续页。

不做：完整 `<noscript>` 分页器（当前用户群体与项目阶段不值得）。

### D6. mock 对齐真后端

`lib/places/mocks.ts` 的 `CITIES_MOCK` / `SPOTS_MOCK` 与 `PlacesSeeder` 对齐（10 城 / 22 景点 + 福州补种后为 11 城 / 24 景点）。

处理要点：

- 移除孤儿 `fuzhou-west-lake`（当前挂在并不存在的 `citySlug: "fuzhou"` 上）；
  重名消歧覆盖改由上游补种的福州承担；
- 对齐后，前端 mock 与后端种子**一一对应**，单测跑在与真实形状一致的数据上；
- `test/mocks/handlers.ts` 的 `/api/spots` handler 从「无视 query 返回全量」改为
  **按 `page` / `size` 切片返回**，并正确计算 `has_more`，否则分页行为测不出来。

### D7. 关于 `Pagination` 组件

`components/places/Pagination.tsx` 在无限滚动落地后不再被 `/spots` 使用。
本次**删除**该文件及其引用（YAGNI：不留死代码）。
若 `app/cities/page.tsx` 仍在使用则保留——实现时先确认引用点。

---

## Risks

### R1. 水合不一致（hydration mismatch）

Server 渲染的 `initialItems` 与 client 首次渲染必须完全一致，
否则 React 报 hydration 错误。本设计中 client 首屏**直接使用 props 的 `initialItems`**、
不在挂载时重新 fetch，从根上避免了该问题。

实现纪律：`SpotInfiniteList` 的 `useState` 初值必须来自 props，
禁止在 `useEffect` 里无条件重新拉取第 1 页。

### R2. `IntersectionObserver` 在 jsdom 中不存在

Vitest + jsdom 环境无 `IntersectionObserver`，测试须 mock。
沿用 `app/posts/_components/PostList.test.tsx` 的既有做法，不另造轮子。

### R3. 既有测试断言会因 mock 对齐而失效

`app/spots/page.test.tsx` 现有断言依赖 mock 独有数据：

- `Mogao Caves`（敦煌）→ 真后端种子无此景点，对齐后消失；
- `q=west` 断言返回 **2 条** `West Lake` → 对齐后真后端只有杭州西湖一条
  （福州西湖需等上游 Change 1 补种后才恢复为 2 条）。

实现时须同步更新这些断言，不得通过「保留旧 mock 数据」绕过。

### R4. `openapi.json` 快照可能已漂移

本 change 不改后端契约，但涉及大量前端取数路径改动。
收尾须跑 `npm run openapi:drift`（需后端在 8080）确认无漂移。

---

## 复用与约束

- 无限滚动的交互细节（sentinel 预取、`loadingRef` / `hasMoreRef` 镜像防闭包陈旧、
  加载后 `unobserve → observe` 同节点强制重判、空页防御）**照抄**
  `app/posts/_components/PostList.tsx` 已验证的实现，不重新发明。
- 标签徽章统一用 shadcn `Badge`，`SpotCard` 现有的裸 `<span>` category 徽章一并收敛。
- 四态遵循 `<harness>/rules/coding-conventions.md` 与样式规约
  （骨架用 `<Skeleton>`、空态居中图标 + 引导 + CTA、错误带重试）。
