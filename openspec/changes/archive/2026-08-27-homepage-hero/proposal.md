## Why

WanderChina 首页首屏（Hero）是用户访问站点的第一触点，直接影响品牌可信度与探索欲。当前首页尚未实现任何 UI（`frontend/` 子仓仍处脚手架阶段），需要先把首屏这个可独立开发、独立测试、独立交付的最小单元落地。

Hero 承载三项核心职责：(1) 全幅品牌主视觉传递调性；(2) 一句话标语 + 副标题建立价值主张；(3) 提供 AI 搜索入口（MVP 仅 UI + 受控状态，真实 AI/路由后续 change 接入）。将其作为独立 change，可在后端与搜索/AI 能力就绪前先行交付与验证，符合"单元可独立交付"拆分原则。

本 change 的完整规格基准已撰写于 `openspec/specs/homepage-hero.md`，本文档与其保持一致。

## What Changes

- 新增 Hero 组件 `frontend/components/homepage/hero.tsx`，实现全幅背景图（`next/image` `fill` + `priority`）、标语、副标题、受控 AI 搜索框。
- 新增 Hero 的强类型 Props 接口 `HeroProps`（见 spec delta），包含 `backgroundImageUrl` / `headline` / `subheadline` / `searchPlaceholder` / `onSearch` / `className`。
- 在首页根路由 `frontend/app/page.tsx` 中以 `homepage-layout` 提供的 Hero 插槽消费该组件（layout 由独立 change 交付；本 change 仅保证组件自身可独立渲染与测试，组装联调在 layout 就绪后）。
- 新增组件单元测试（Vitest + React Testing Library）覆盖：空查询不触发 `onSearch`、非空查询触发 `onSearch`、背景图加载失败兜底。
- **不实现**搜索结果页、AI 调用、路由跳转——`onSearch` 仅预留回调签名，落地由后续 change 负责。

## Capabilities

### New Capabilities
- `homepage-hero`: 定义 WanderChina 首页首屏 Hero 区的视觉、交互、Props 契约与验收标准，作为后续首页其他区域（platform-nav / destinations / community / ai-fab）组装的布局消费者之一。

### Modified Capabilities
- 无。

## Impact

- **前端组件**：新增 `frontend/components/homepage/hero.tsx` 及其测试；不影响既有脚手架文件。
- **依赖**：依赖 `homepage-layout`（插槽顺序/间距/容器约定）、全局 `next/font` 字体变量、Tailwind/shadcn 主题。被 `frontend/app/page.tsx` 消费。
- **数据**：纯静态首屏，无 API 依赖；背景图 URL 写死或经 Props 传入，MVP 用 picsum 占位，后续仅改 URL 不改结构。
- **约束合规**：技术栈符合 `tech-stack` spec（Next.js 14 App Router + React + TypeScript + Tailwind/shadcn）；遵循 `always_applied_workspace_rules` 样式规约（全幅图叠层渐变、白字对比度、focus-visible、lucide 图标、next/image 优化）。
- **团队**：无新学习成本，纯前端组件。
