# Tasks — api-spots (P4)

## 4. 后端 + 前端接入（api-spots，P4）

- [x] 4.1 后端 `City` / `Spot` 实体（JPA, BaseEntity 继承），字段对齐 `specs/places`；`slug` 唯一索引、`citySlug` 非空约束
- [x] 4.2 REST：`GET /api/cities`、`/api/cities/{slug}`、`/api/spots`、`/api/spots/{slug}`
- [x] 4.3 分页/筛选/排序（offset 模式 + total 重算 has_more）对齐 design；OpenAPI 由 springdoc 自动产出
- [x] 4.4 `viewCount` 累加机制：详情访问经 `ViewCountService` 异步 +1（`CompletableFuture.runAsync`），按 `(slug, clientIp)` 进程内限频防刷
- [x] 4.5a 前端 `lib/places/client.ts`：真实 `fetchCities` / `fetchSpots` / `fetchCityBySlug` / `fetchSpotBySlug`，snake_case→camelCase 适配（`mapCity`/`mapSpot`），枚举转小写；前端契约类型（`types.ts`）保持不变
- [x] 4.5b 首页/列表/详情组件从 mock 切真实 fetch：数据获取上移到页面级 Server Component（async），插槽/详情/卡片改为纯展示（prop 驱动）；5 个 places 页面 `export const dynamic = "force-dynamic"`（避免构建期 SSG 触发网络请求）；`Spot` 反范式携带 `cityNameEn/Zh`（client 按 citySlug 关联 City 列表填充），`SpotCard`/`SpotDetail` 不再同步查城市
- [x] 4.6 `next.config` `images.remotePatterns` 放行 `localhost:8080` 后端图床
- [x] 4.7 `openapi:sync` + `openapi:gen` + `openapi:drift` 校验一致（后端运行在 8080 执行；`openapi.json` 已含 `/api/cities`、`/api/spots` 等 places 端点，`drift` 通过）

## 实现注记

- 后端模块 `com.mooc.backend.places`：实体（`City`/`Spot`/`SpotCategory`）、仓储（含原生 JSON 列筛选：城市 `highlights`、景点 `tags`）、服务（`CityService`/`SpotService`/`ViewCountService`）、DTO（`CitySummary`/`CityDetail`/`SpotSummary`/`SpotDetail` + 分页信封）、控制器（`CitiesController`/`SpotsController`）。
- 错误码 `CITY_NOT_FOUND` / `SPOT_NOT_FOUND` 已加入 `ErrorCode`；`GlobalExceptionHandler` 已处理 `PlacesException`；`SecurityConfig` 已放行四个公开 GET 端点。
- 城市 `tag` 筛选语义：城市无独立 tags 字段，以 `highlights`（必玩清单）承载（对齐前端 `City.tags`），后端用 `JSON_CONTAINS(highlights, ...)`。
- 新增 `lib/places/client.ts`（接入层）+ `lib/places/client.test.ts`（4 例，经 msw 验证映射/枚举/404）+ `test/mocks/handlers.ts` 增补 `/api/cities`、`/api/cities/{slug}`、`/api/spots`、`/api/spots/{slug}` handlers。
- 验证：`mvn test` 后端 277 例全绿（含 `CityRepositoryTest` 4、`SpotRepositoryTest` 5、`PlacesApiTest` 6）；`npm run type-check` 通过；`lib/places/client.test.ts` 4 例通过；其余前端测试未回归（新增 handlers 仅命中 `/api/cities|spots`，无其它测试触达）。

## P4.5b 组件切换实现说明（已完成）

- `lib/places/index.ts`：`getTopCities`/`getTopSpots`/`getCityBySlug`/`getSpotBySlug`/`getSpotsByCity`/`getSpotNeighbors`/`filterCities`/`filterSpots` 全部 `await` 调用 `client.ts`；保留本地筛选/排序/分页逻辑（在已拉取数据集上运行，保证列表筛选/分页行为确定且服务端同语义过滤幂等）。选项列表（`listProvinces` 等）与"相关攻略"占位仍取自 mock（待 P6 接真实聚合）。
- 页面/插槽：`app/page.tsx`、`app/regions/HotSpotsSlot.tsx`、`app/regions/CityGridSlot.tsx`、`app/cities/page.tsx`、`app/spots/page.tsx`、`app/cities/[slug]/page.tsx`、`app/spots/[slug]/page.tsx` 全部改为 async Server Component；插槽改为纯展示 prop 驱动。5 个页面加 `export const dynamic = "force-dynamic"`。
- 城市名反范式：前端 `Spot` 加 `cityNameEn?/cityNameZh?`；`client.ts` 的 `ensureCityIndex()` 拉一次城市列表建 `citySlug→城市名` 索引，`fetchSpots` 映射时补上；`SpotCard`/`SpotDetail` 改用 `spot.cityNameEn`，移除同步 `getCityBySlug` 调用。
- 测试适配：`app/page.test.tsx`、`HotSpotsSlot.test.tsx`、`CityGridSlot.test.tsx`、`CityDetail.test.tsx`、`SpotDetail.test.tsx`、`cities/page.test.tsx`、`spots/page.test.tsx`、`selectors.test.ts` 改为 `render(await Component(...))` + `await` 选择器；`CityDetail`/`SpotDetail` 测试用 `beforeAll(async)` 拉取异步数据。
- 验证：前端 `npm run type-check` 通过；`npm run build` 通过（5 个 places 页为 `ƒ` 动态渲染）；`lib/places` + `app/regions` 测试 32 例全绿、`app/page.test.tsx` 3 例全绿、各列表/详情页测试全绿（组件切换无回归）。

## 收尾待办（需后端运行在 8080 或用户本地执行）

1. `npm run openapi:sync` → `openapi:gen` → `openapi:drift`（校验一致；当前 `openapi.json` 尚未含 places 端点，需后端起服后刷新）。
2. `type-check`/`tests`/`build` 全绿后，提交 `backend/`、`frontend/` submodule 指针并归档本 change。
