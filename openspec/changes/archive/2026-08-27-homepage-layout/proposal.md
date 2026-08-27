## Why

WanderChina 首页由 6 个独立单元组成（hero / platform-nav / destinations / community / ai-fab / layout）。其中 5 个功能区域若各自为政会出现视觉错位、Section 间距不一致、容器宽度漂移。需要一个**共享布局根壳**来统一：区域插槽顺序、Section 间距 token、响应式容器、四态兜底规范。该根壳被其他单元依赖，但不依赖任何单元，应最先交付以便后续组装。

`homepage-hero` 已实现并通过单测，但其验收项 5.3（在 `app/page.tsx` 的 Hero 插槽联调）依赖本 layout 就绪。本 change 实现后，可回补 `homepage-hero` 的联调任务并归档它。

## What Changes

- 新增首页布局组件 `frontend/components/homepage/homepage-layout.tsx`，提供语义化插槽：`<HeroSlot>`、`<PlatformNavSlot>`、`<DestinationsSlot>`、`<CommunitySlot>`、以及固定 `<AIFabSlot>`（悬浮，不占流布局）。
- 定义并在组件中应用全局 Section 间距（使用 `globals.css` 已有的 `--spacing-section` / `--spacing-section-mobile` CSS 变量，不自定义 padding）。
- 定义响应式内容容器：`mx-auto max-w-6xl px-6`（与样式规约一致）。
- 在首屏 Hero 插槽实际挂载已实现并验证过的 `<Hero>` 组件（完成 homepage-hero 的 5.3 联调）。
- 为数据型区域（destinations / community）提供四态复用组件 `RegionState`（`loading` / `content` / `empty` / `error`），供后续 change 直接消费，本 change 仅定义契约与占位插槽（不实现真实数据获取）。
- 在 `frontend/app/page.tsx` 用 `HomepageLayout` 组装首屏，使首页可见 Hero。
- **不实现** platform-nav / destinations / community / ai-fab 的真实内容（各走独立 change）；layout 仅预留插槽，未实现区域以占位/不渲染处理。

## Capabilities

### New Capabilities
- `homepage-layout`: 定义 WanderChina 首页的布局根壳契约——区域插槽顺序、Section 间距、响应式容器、四态兜底组件，作为其他首页单元组装的容器。

### Modified Capabilities
- 无（但会触发 `homepage-hero` 的 5.3 联调任务完成，属跨 change 进度更新，不修改 hero spec）。

## Impact

- **前端组件**：新增 `homepage-layout.tsx` + `region-state.tsx`（四态组件）；修改 `app/page.tsx` 消费布局；`homepage-hero` 的 5.3 在本 change 落地后勾选。
- **依赖**：依赖 `homepage-hero`（Hero 组件）、全局 CSS 变量（`--spacing-section` 等）、Tailwind/shadcn 主题。被 `platform-nav` / `destinations` / `community` / `ai-fab` 消费其插槽与 `RegionState`。
- **数据**：纯布局，无 API 依赖；未实现区域不触发请求。
- **约束合规**：符合样式规约（max-w-6xl、px-6、Section 间距变量、四态覆盖、卡片可见性等）；技术栈符合 `tech-stack` + `frontend-nextjs-scaffold` spec（Next 14 App Router、Tailwind 4、shadcn、lucide）。
