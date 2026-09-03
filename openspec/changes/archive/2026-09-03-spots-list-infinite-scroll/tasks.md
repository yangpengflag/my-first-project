# Tasks — spots-list-infinite-scroll

> **前置阻塞**：`spots-data-correctness` 必须先完成并归档（排序 tie-breaker + 种子 tags/rating 补全）。
> 否则：分页会错乱、卡片标签与评分在真实数据下仍不可见。
>
> **TDD 纪律**：先写失败测试（RED），确认因预期原因失败，再实现（GREEN）。

## 1. 环境变量统一（先行，否则后续调试会被误导）

- [ ] 1.1 确认 `frontend/.env.local` 现有变量名（记载为 `BACKEND_URL`，与代码读取的
      `NEXT_PUBLIC_API_BASE_URL` 不一致），统一为 `NEXT_PUBLIC_API_BASE_URL`
- [ ] 1.2 新增 / 更新 `frontend/.env.local.example`，同步 `frontend/README.md` 的环境配置段落

## 2. 真分页改造

- [ ] 2.1 **RED**：`lib/places/selectors.test.ts` 新增断言——`filterSpots({ page: 2, size: 6 })`
      返回的第 1 条 **不等于** `filterSpots({ page: 1, size: 6 })` 的任何一条
      （当前实现一次拉全量后本地切片，此断言可暴露"假分页"）
- [ ] 2.2 **GREEN**：`lib/places/index.ts` 的 `filterSpots` 改为直接 `fetchSpots(query)`，
      把 `city` / `category` / `tag` / `q` / `sort` / `page` / `size` 全下推后端；
      删除本地 `filter` / `sort` 逻辑
- [ ] 2.3 **RED→GREEN**：`test/mocks/handlers.ts` 的 `GET /api/spots` 从"无视 query 返回全量"
      改为按 `page` / `size` 切片，并正确计算 `has_more` 与 `total`
- [ ] 2.4 **回归**：`lib/places/client.test.ts` 全绿

## 3. 卡片渲染 tags

- [ ] 3.1 新增 shadcn `badge` 组件（`components/ui/badge.tsx`）
- [ ] 3.2 **RED**：`SpotCard` 测试——断言标签渲染、超过 3 个折叠为 `+N`、
      `tags: []` 时不渲染标签行且不占位
- [ ] 3.3 **GREEN**：`components/places/SpotCard.tsx` 渲染 tags；
      把现有裸 `<span>` 的 category 徽章一并收敛到 `Badge`
- [ ] 3.4 **回归**：`app/regions/HotSpotsSlot.test.tsx`（首页槽位复用 SpotCard）仍绿

## 4. 筛选项接真后端

- [ ] 4.1 **RED**：断言 `listCityOptions()` 返回的 slug 集合包含真后端独有的城市
      （`beijing` / `shanghai` / `lhasa` / `guangzhou` / `chongqing`），
      且不包含后端没有的（`suzhou` / `dunhuang` / `zhangjiajie`）
- [ ] 4.2 **GREEN**：`listCityOptions()` 改为从 `/api/cities` 聚合；
      `listSpotTags()` 改为从景点数据聚合（不再读 `SPOTS_MOCK`）
- [ ] 4.3 手工验证：下拉里选中北京能筛出故宫等景点；不再出现"筛出必空"的城市

## 5. mock 对齐真后端

- [ ] 5.1 `lib/places/mocks.ts` 的 `CITIES_MOCK` / `SPOTS_MOCK` 与 `PlacesSeeder` 对齐
      （含上游补种的福州，届时共 11 城 / 24 景点）
- [ ] 5.2 移除孤儿 `fuzhou-west-lake`（挂在并不存在的城市上）
- [ ] 5.3 更新 `app/spots/page.test.tsx` 因 mock 对齐而失效的断言（见 `design.md` R3）：
      - 移除 `Mogao Caves`（敦煌，真后端无此景点）
      - `q=west` 的条数断言按上游补种后的实际重名情况校正
- [ ] 5.4 **回归**：`lib/places/mocks.test.ts` 全绿

## 6. 无限滚动组件

- [ ] 6.1 **RED**：`components/places/SpotInfiniteList.test.tsx`——
      首屏使用 `initialItems` 直出（不额外 fetch）；sentinel 触底触发 `page=2` 请求并追加结果
- [ ] 6.2 **GREEN**：新增 `SpotInfiniteList`（client component），
      照抄 `app/posts/_components/PostList.tsx` 的成熟实现细节：
      sentinel + `IntersectionObserver`（`rootMargin` 预取）、
      `loadingRef` / `hasMoreRef` 镜像 state 防闭包陈旧、
      每次加载后 `unobserve → observe` 同节点强制重判、空页防御
- [ ] 6.3 **RED→GREEN**：四态齐全——加载骨架 / 内容 / 空态（引导 + CTA）/
      错误（首屏错误与续拉错误分开，续拉失败保留已加载内容 + 重试）
- [ ] 6.4 **GREEN**：`app/spots/page.tsx` 接入 `SpotInfiniteList`，
      传 `key={queryKey}` 使筛选变化时强制 remount（见 `design.md` D1）
- [ ] 6.5 **RED→GREEN**：`?page=N+1` 的 `rel="next"` 视觉隐藏链接（SEO 补偿，见 `design.md` D5）
- [ ] 6.6 删除 `components/places/Pagination.tsx`——**先确认** `app/cities/page.tsx` 是否仍引用

## 7. 验证与收尾

- [ ] 7.1 前端 `npm run type-check` 全绿
- [ ] 7.2 前端 `npm run test` 全绿（含 mock `IntersectionObserver`，见 `design.md` R2）
- [ ] 7.3 前端 `npm run build` 全绿（先停 dev server，避免共写 `.next` 导致 webpack 错乱）
- [ ] 7.4 `npm run openapi:drift`（需后端 8080 运行）确认无契约漂移
- [ ] 7.5 手工验证（**必须起真实后端**，msw 下看不出真分页问题）：
      - 首屏直出（禁用 JS 或用 curl 确认 HTML 含卡片内容）
      - 滚动到底自动续拉，无重复、无遗漏
      - 切换城市 / 排序后列表重置，不残留旧结果
      - 断网续拉 → 已加载内容保留 + 显示重试
      - 卡片显示评分与标签
