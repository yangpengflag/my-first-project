# Brief: homepage-shell

## 一句话描述
定义首页页面级外壳：根布局、全局导航、页脚、元数据、字体与容器约束。

## 功能边界
- 包含：`app/layout.tsx`、`app/page.tsx` 的页面骨架、顶部导航栏、页脚、SEO 元数据、全局字体/主题切换入口、页面最大宽度与内边距。
- 不包含：Hero 内容、功能导航卡片、具体业务模块。

## 数据依赖
- 静态内容（导航文案、Logo、版权信息）。

## 依赖关系
- 上游：frontend-styling-stack。
- 下游：homepage-hero、homepage-feature-nav、homepage-city-grid、homepage-hot-posts、homepage-hot-spots、homepage-ai-launcher。