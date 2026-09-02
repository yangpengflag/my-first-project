# Design (spots-frontend-mock)

- 字段契约见 `specs/places/spec.md`，本 change 不重复定义。
- P0 `lib/places/types.ts` **镜像未来 openapi 生成客户端**（camelCase），mock 仅填充数据；切换真实 API 时零摩擦。
- **复合 slug 作为不透明路由键**：`/spots/[slug]` 整段即 `citySlug-spotSlug`，系统不对复合 slug 做分割解析（城市名可能含连字符，如 `new-york`）。城市身份以 `citySlug` 字段为准。
- 双语渲染：`nameEn` 主显 + `nameZh` 副标；`category` 英文枚举常量 + 双语 label 映射（`nature → 自然 / Nature`）。
- 首页语义：`HotSpotsSlot` 按 `project.md` 定义为 **Hidden Spot / 小众精选**，排序优先 `hiddenGem=true`、不足则以 `featured=true` 补足（非纯 `viewCount` 热门）；`/spots` 列表提供 `popular`（viewCount）与 `hidden`（hiddenGem 优先）两种排序。`CityGridSlot` 按 `featured` 取 Top N。区块标题用「小众推荐 / Hidden Gems」而非「热门景点」。
- 地图：仅静态 `lat/lng` + 外链 Google Maps / 高德（project out-of-scope 交互地图）。
- 分页 / 无限滚动复用 `post-list` 既有模式。
- 详情页相关攻略区用 mock `PostSummary[]` 占位；真实聚合待 `post-location-tagging`。
- 必须落盘占位图资产：`public/images/spots/*.webp`、`public/images/cities/*.webp`。
