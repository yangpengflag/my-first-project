# Brief: frontend-styling-stack

## 一句话描述
确立首页前端技术样式栈：Tailwind CSS v4 主题变量、shadcn/ui 基础组件、响应式断点与图标系统。

## 功能边界
- 包含：全局 CSS 变量与 `@theme` 映射、Button/Input/Skeleton 等 shadcn 基础组件、Lucide 图标、移动端优先的响应式断点、容器/间距/字体规范。
- 不包含：业务组件、页面布局、页面级数据获取。

## 数据依赖
- 纯静态配置，无 API。

## 依赖关系
- 上游：无。
- 下游：homepage-shell、homepage-hero、homepage-feature-nav、homepage-city-grid、homepage-hot-posts、homepage-hot-spots、homepage-ai-launcher。