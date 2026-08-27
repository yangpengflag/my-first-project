# Brief: homepage-hot-spots

## 一句话描述
首页热门景点/POI 榜单：具体景点推荐卡片，承接"景点攻略"入口。

## 功能边界
- 包含：热门景点卡片列表（景点图、景点名、所在城市、一句话卖点、评分/热度）、响应式网格。
- 不包含：景点详情页、门票预订、地图导航。

## 数据依赖
- 初期：静态 JSON mock 数据。
- 后续：可替换为 `/api/spots` 或景点 API。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell、homepage-feature-nav（从景点攻略入口延伸）。
- 下游：无（被 homepage 页面组合，或可跳转到景点详情）。