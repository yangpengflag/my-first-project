## Context

`homepage-hero` 已实现并通过单测，但因首页根壳（`homepage-layout`）未就绪，Hero 尚未在真实 `app/page.tsx` 中联调（验收项 5.3 待办）。同时其余 4 个区域（platform-nav / destinations / community / ai-fab）将作为独立 change 实现，它们需要一个统一的容器来约定插槽顺序、Section 间距、响应式容器与四态兜底。

样式规约已定义全局 token：`--spacing-section: 96px`（desktop）/ `--spacing-section-mobile: 64px`（mobile），通过 `section[data-region] { padding-block }` 全局应用；内容容器 `mx-auto max-w-6xl px-6`；四态覆盖（Loading/Content/Empty/Error）为 MUST 级约束。

## Goals / Non-Goals

**Goals:**
- 交付一个可独立渲染、可测试的 `HomepageLayout` 组件，定义清晰的插槽 API。
- 在 Hero 插槽挂载已实现的 `<Hero>`，完成首页首屏可见联调。
- 提供 `RegionState` 四态复用组件（Skeleton/Content/Empty/Error），供数据型区域直接消费。
- 严格复用全局间距/容器 token，不自定义 section padding。

**Non-Goals:**
- 不实现 platform-nav / destinations / community / ai-fab 的真实内容（各走独立 change）。
- 不实现任何数据获取逻辑（layout 仅提供插槽与状态组件契约）。
- 不引入路由/AI 调用（属于各自 change）。

## Decisions

1. **插槽 API 用 children 分桶**：`HomepageLayout` 接收命名 props（`hero` / `platformNav` / `destinations` / `community` / `aiFab`）作为 ReactNode，按顺序渲染。Hero 为全幅首屏（不套 max-w 容器），其余内容区域套 `max-w-6xl px-6` 容器并按 `--spacing-section` 分隔。
2. **间距由全局 CSS 变量驱动**：区域包裹 `<section data-region="...">`，依赖 `globals.css` 已有的 `section[data-region] { padding-block: var(--spacing-section) }`（若未定义则在本 change 的 globals 补充该规则，不写死 px）。
3. **响应式容器**：内容区统一 `mx-auto max-w-6xl px-6`（移动端 px-6 即 24px，符合规约禁止 px-4 以下贴边）。
4. **四态组件 `RegionState`**：接收 `status: 'loading'|'content'|'empty'|'error'` + 各态渲染 props（loading 用 shadcn Skeleton 组合；empty/error 用 lucide 图标 + 引导文案 + 可选 CTA/retry）。`content` 态直接渲染 children。供 destinations/community 等数据型区域复用。
5. **Hero 联调**：`app/page.tsx` 渲染 `<HomepageLayout hero={<Hero backgroundImageUrl="https://picsum.photos/1920/1080" onSearch={...} />} />`，完成 homepage-hero 5.3。`onSearch` 暂用占位回调（console/no-op 或 push 到 `/search` 预留），不实现真实逻辑。
6. **未实现区域处理**：platformNav/destinations/community 插槽在对应 change 未就绪时传 `null` 或占位，layout 不强制渲染；aiFab 悬浮按钮由 ai-fab change 注入，本 change 预留 `aiFab` 插槽 prop。
7. **悬浮层**：aiFab 区域不参与流布局（fixed 定位由 ai-fab 组件自身处理），layout 仅提供挂载点。

## Risks / Trade-offs

- [Risk] `globals.css` 可能未定义 `section[data-region]` 的 padding 规则 → Mitigation: 本 change 在 `globals.css` 补充该全局规则（一行），保持 token 驱动。
- [Risk] Hero 联调后 homepage-hero 验收项需回补勾选 → Mitigation: 本 change 完成后，更新 homepage-hero tasks.md 的 5.3 为 [x] 并归档 homepage-hero。
- [Risk] 四态组件过早抽象（YAGNI）→ Mitigation: 仅定义契约与最小实现，真实使用在 destinations/community change，不预支其他功能。

## Migration Plan

1. 批准本 change。
2. 实现 `homepage-layout.tsx` + `region-state.tsx` + globals.css 间距规则 + `app/page.tsx` 联调 Hero。
3. TDD：写布局测试（插槽顺序、容器类、四态渲染）。
4. 子仓 commit/push，父仓更新指针。
5. 回补 `homepage-hero` 5.3 勾选并归档 homepage-hero。
6. 归档本 change，`homepage-layout` 固化为主 spec。

## Open Questions

- `onSearch` 占位行为：`console.log` 还是预留 `/search` 路由？→ 默认 no-op + 注释，路由由后续搜索 change 实现。
- 内容区是否需要在落地页套 `min-h-screen bg-gradient-to-b from-slate-50 to-white`？→ 按样式规约，非首屏内容页用该背景；首页为全幅摄影风，Hero 之下内容区可用 `bg-slate-50`。
