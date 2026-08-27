# Brief: homepage-city-grid

## 一句话描述
首页热门目的地推荐：4-6 张城市卡片，含封面图、城市名、亮点与热度标签。

## 功能边界
- 包含：城市卡片网格（封面图、城市名、一句话亮点、热度标签/徽章）、响应式列数、加载占位。
- 不包含：城市详情页、预订/收藏功能。

## 数据依赖
- 初期：静态 JSON mock 数据。
- 后续：可替换为 `/api/cities` 或 CMS API。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell。
- 下游：无（被 homepage 页面组合）。