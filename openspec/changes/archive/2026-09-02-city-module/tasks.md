# Tasks — city-module

## 1. 后端 City 模型精简（TDD：RED → GREEN）

- [x] 1.1 RED：改写 `CityRepositoryTest` 断言新契约 —— 列表按 `name` 升序分页（无 province/tag/view_count 语义）、`slug` 唯一冲突、软删行被过滤；删除针对 `province`/`highlights`/`view_count` 的旧断言，先跑红
- [x] 1.2 GREEN：新增 `CitySlugs.slugify`（小写、非 `[a-z0-9]` 连续序列→单 `-`、去端部 `-`）+ 单测（`Hangzhou→hangzhou`、`Xi'an→xi-an`）
- [x] 1.3 GREEN：精简 `City` 实体为 `name`/`name_zh`/`slug`(UNIQUE)/`cover_image`/`description`(TEXT)/`best_season` + BaseEntity；移除旧列映射与 `incrementViewCount`
- [x] 1.4 删除 `CityRepositoryCustom`/`CityRepositoryImpl`（原生 SQL 无再用）；`CityRepository` 改为派生查询 `Page<City> findByDeletedFalse(Pageable)`、`findBySlug`（seed 判重用，含软删）、保留 `findBySlugAndDeletedFalse`
- [x] 1.5 收敛 `CitySummary`/`CityDetail` 出网白名单：`slug/name/name_zh/cover_image/description/best_season/spot_count`（+`top_spots`/`related_posts`）；`CityService.list/getBySlug` 相应简化；`CitiesController` 移除 province/tag/sort 参数与详情异步计数
- [x] 1.6 `ViewCountService` 移除 `recordCityView` 与 `CityRepository` 注入（`recordSpotView` 保留）；清理受影响调用点
- [x] 1.7 更新 `PlacesApiTest`（`GET /api/cities` 默认 name 升序、无筛选参数、详情 `404 CITY_NOT_FOUND`）并全量 `mvn test` 绿（后端无回归，含 CityRepositoryTest 新断言）

> 命令：`cd backend; $env:JAVA_HOME="D:\Programs\java17"; & "D:\Programs\maven\bin\mvn.cmd" -o test -Dtest=CityRepositoryTest,PlacesApiTest`

## 2. 种子数据导入（@Profile("seed")）

- [x] 2.1 RED：新增 `PlacesSeederTest` 断言 spec Scenario —— ①重复执行两次数量不变且无异常 ②每条 spot 的 `citySlug` 均能在 cities 找到（无孤儿）③`name="Hangzhou"` 落库 `slug="hangzhou"`（无需手工提供）
- [x] 2.2 GREEN：新增 `seed/PlacesSeeder.java`（`ApplicationRunner` + `@Profile("seed")`）：逐条按 `slug` 判重幂等 upsert；slug 经 `CitySlugs.slugify` 自动生成；Spot 复合 slug `{citySlug}-{spotName}` 内部拼出
- [x] 2.3 种子数据源：10 城市（beijing/shanghai/xian/chengdu/hangzhou/guilin/lhasa/lijiang/guangzhou/chongqing）常量 + 每城 2–3 景点常量；`name`/`description` 英文撰写；`coverImage` 用 picsum 占位 URL
- [x] 2.4 本地 MySQL 验证：`DROP TABLE IF EXISTS wanderchina.cities;` → 常规启动重建表 → `seed` profile 起服一次灌数 → 重复起 seed 验证幂等（行数不变）→ 直查库确认归属
- [x] 2.5 PlacesSeederTest 全绿纳入 `mvn test`

## 3. 前端类型与数据层适配

- [x] 3.1 精简 `lib/places/types.ts` 的 `City`（`slug/name/nameZh/coverImage/description/bestSeason/spotCount`）；`Spot.cityNameEn/cityNameZh` → `cityName`
- [x] 3.2 `lib/places/client.ts`：`RawCity`/`mapCity` 收敛字段；`CityQuery` 去 province/tag/sort；`ensureCityIndex` 改建 `{name,nameZh}` 索引并回填 `cityName`
- [x] 3.3 `lib/places/mocks.ts` `CITIES_MOCK` 收敛为新字段；`test/mocks/handlers.ts` `cityToRaw` 对齐
- [x] 3.4 `lib/places/index.ts`：`getTopCities` 改按 `name` 升序取 Top N；`filterCities` 去 province/tag/sort 仅 name 升序分页；删 `listProvinces`/`listCityTags`；`listCityOptions` 返回 `{slug,name,nameZh}`
- [x] 3.5 适配 `client.test.ts` / `selectors.test.ts` / `mocks.test.ts`（删 viewCount/tags/province 断言、改 name/description）并跑绿

## 4. 前端展示与页面适配

- [x] 4.1 `CityCard.tsx`/`CityGridSlot.tsx`/`cities/page.tsx`：去 `CityFilters` 省份/标签区块与 query 解析；卡片显 `name`+`nameZh`+`description`+`spotCount`；首页城市榜接新 `getTopCities`
- [x] 4.2 `cities/[slug]/_components/CityDetail.tsx`：显 `description`（单字段）、`bestSeason`、Top POI、`spotCount`；删 province/highlights/featured/viewCount 区块
- [x] 4.3 Spot 侧反范式迁移：`SpotCard`/`SpotDetail`/`SpotFilters`/`spots/page.tsx` 改用 `spot.cityName` 与 `listCityOptions` 新形状
- [x] 4.4 适配受影响组件测试：`CityGridSlot.test.tsx`、`CityDetail.test.tsx`、`cities/page.test.tsx`、`cities/[slug]/page.test.tsx`、`spots` 相关夹具、`app/page.test.tsx` 等全部跑绿

## 5. 端到端验证与收尾

- [x] 5.1 `npm run type-check` / `npm test` / `npm run build` 全绿
- [x] 5.2 起后端（常规 profile）→ `npm run openapi:sync` + `openapi:gen` + `openapi:drift`（顺带收掉 api-spots 4.7 挂起项）
- [x] 5.3 双服务手工验证：`/cities` 有 10 城市、详情页字段正确、`/spots` 列表与详情显示归属城市名、首页城市榜有数据
- [x] 5.4 提交 `backend/`、`frontend/` submodule 变更；`openspec validate --change city-module` 通过后归档本 change
