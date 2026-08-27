# Brief: homepage-feature-nav

## 一句话描述
首页三大平台入口卡片：旅游社区、景点攻略、AI 助手。

## 功能边界
- 包含：三个入口卡片（图标 + 标题 + 一句话描述）、卡片悬停/聚焦态、响应式网格布局。
- 不包含：各平台内部页面、AI 对话实现。

## 数据依赖
- 静态文案与图标。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell。
- 下游：homepage-hot-spots（从景点攻略入口延伸）、homepage-ai-launcher（从 AI 助手入口延伸）。