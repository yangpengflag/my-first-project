# Tasks — spots-frontend-mock (P0–P3)

> P0–P3 已全部落地（mock 驱动首页双槽 + 列表页 + 详情页）。验证：`npm test` 210 passed（32 文件）、`npm run build` 通过（含 `/cities`、`/spots` 及其详情页动态 SSR）。

## P0 契约定型 ✅

- [x] 0.1 新增 `lib/places/types.ts`：`City` / `Spot` / `SpotCategory` 枚举（nature/culture/history/food/district/leisure），对齐 `specs/places`
- [x] 0.2 新增 `lib/places/mocks.ts`：`CITIES_MOCK` / `SPOTS_MOCK`（双语、复合 slug、含两处 `West Lake` 重名样例）
- [x] 0.3 slug 唯一自检 + 无负计数（`lib/places/mocks.test.ts`）
- [x] 0.4 详情相关攻略区预留 mock 接口 `getRelatedPostsForSpot`（真实聚合待 `post-location-tagging`）

## P1 首页双槽 ✅

- [x] 1.1 填充 `HotSpotsSlot`：Top N Spot 卡片（封面 + 双语名 + 城市后缀 + 浏览量 + 链接 `/spots/<slug>`）；排序优先 `hiddenGem`、不足补 `featured`；标题「小众推荐 / Hidden Gems」
- [x] 1.2 填充 `CityGridSlot`：Top N City 卡片（封面 + 双语名 + 链接 `/cities/<slug>`）
- [x] 1.3 响应式网格（1/2/3 列）+ `aria-label` 含城市名 + 空态降级
- [x] 1.4 单测 `HotSpotsSlot.test` / `CityGridSlot.test`
- [x] 1.5 `app/page.test.tsx` GREEN + `npm run build` 通过

> 实现注记：卡片封面沿用 `PostCard` 惯例用 `bg-cover` + 占位符（非 `next/image`），以避免远程图域名配置；P4 切真实 API 时若用 `next/image` 需补 `next.config` `remotePatterns`（已记入 `api-spots` change）。

## P2 列表页 ✅

- [x] 2.1 `/cities`：省份 + 标签筛选 + 排序（`popular`/`name`）+ 分页（size 6）
- [x] 2.2 `/spots`：城市 + 分类 + 标签筛选 + 搜索 `q` + 排序（`popular`/`hidden`）+ 分页
- [x] 2.3 `CityCard` / `SpotCard` 组件（复用 P1 视觉，`bg-cover` + 占位符，`aria-label` 含城市名）
- [x] 2.4 筛选/搜索状态 URL query 同步（客户端 `Select` + `useRouter.replace`，不走 `useSearchParams` 以避开 Suspense 坑）；`EmptyState` 四态空结果
- [x] 2.5 单测：`app/cities/page.test.tsx`（4 例）、`app/spots/page.test.tsx`（5 例）、`lib/places/selectors.test.ts`（20 例，覆盖筛选/搜索/分页/重名消歧）

> 实现注记：列表页为 **Server Component** 直读 `searchParams` + 选择器（`filterCities`/`filterSpots`）；筛选条为客户端组件改写 URL。新增 `lib/places/url.ts`（`buildQuery` 合并 query、删空/"all" 哨兵）、`lib/places/labels.ts`（分类双语 label 集中，卡片与筛选条共用）、`components/ui/select.tsx`（基于 `@radix-ui/react-select`，规则合规）、`components/places/Pagination.tsx`（服务端友好纯 `<Link>`）、`components/places/EmptyState.tsx`。

## P3 详情页 ✅

- [x] 3.1 `/spots/[slug]`：`SpotDetail`（封面 Hero / 双语名 / 信息网格 / Google+Amap 外链 / 周边 POI / 相关攻略占位）
- [x] 3.2 `/cities/[slug]`：`CityDetail`（封面 / 双语名 / 简介 / 必玩 chips / 下属 POI 网格 / 相关攻略占位）
- [x] 3.3 相关攻略区 mock `RelatedPost[]`（`getRelatedPostsForSpot`/`getRelatedPostsForCity`）；周边 POI mock（`getSpotNeighbors`）
- [x] 3.4 双语渲染 nameEn 主显 + nameZh 副标 + 英文缺失时中文兜底；SSR 直出（`/cities`、`/spots` 为 `ƒ` 动态 SSR 路由）
- [x] 3.5 单测：`SpotDetail.test.tsx`（4 例）、`CityDetail.test.tsx`（3 例）、`page.test.tsx`（各 2 例，覆盖 `notFound()`）；`npm run build` ✅

> 实现注记：详情页 server wrapper（`notFound()` 守卫）+ 展示型 `_components/SpotDetail`/`CityDetail`，测试直测展示组件。`RelatedPosts` 抽为 `components/places/RelatedPosts.tsx` 共享，避免跨路由引用。Lighthouse a11y 目标待实跑 e2e 阶段补，结构与对比度已按规则落实。`/posts` 链接为占位（社区模块待建）。
