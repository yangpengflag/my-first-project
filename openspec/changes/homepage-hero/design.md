## Context

WanderChina 首页首屏需在后端与搜索/AI 能力就绪前独立交付。技术栈已锁定为 Next.js 14 (App Router) + React + TypeScript + Tailwind CSS 4 + shadcn/ui (base-nova) + lucide-react（见 `tech-stack` spec）。样式规约要求全幅摄影 + 大留白 + 克制配色 + 探索感，白字需叠层渐变兜底，图标统一用 lucide-react，图片用 `next/image` 优化。

本组件为纯静态 UI（无异步数据），故不引入 Loading/Empty/Error 四态；搜索框仅做受控输入与 `onSearch` 回调转发，AI 与路由逻辑下沉后续 change。

## Goals / Non-Goals

**Goals:**
- 交付一个视觉完整、可访问、响应式的 Hero 组件，单元可独立测试。
- 严格遵循 props 契约（`HeroProps`），父级可通过 Props 覆盖文案与图，预留 `onSearch` 扩展点。
- 满足 WCAG AA：白字叠 `from-black/60 to-transparent` 渐变，对比度 ≥ 4.5:1。

**Non-Goals:**
- 不实现搜索结果页 / 路由跳转（后续 change）。
- 不接入真实 AI 调用（后续 change 与 `homepage-ai-fab` 共享 `lib/ai` 客户端时再约定）。
- 不实现背景图轮播 / parallax / 动效（留独立 change）。

## Decisions

1. **`next/image` fill + priority** — 背景图用 `<Image fill priority className="object-cover" />`，外层 `relative` 容器定高，避免 CLS；`priority` 提升首屏 LCP。装饰性设 `aria-hidden`。
2. **叠层渐变保证可读性** — 在 Image 之上叠 `absolute inset-0 bg-gradient-to-r from-black/60 to-transparent`（桌面左重），移动端用 `from-black/50` 全幅或 `bg-gradient-to-t` 兜底；文字置于 overlay 之上 z-index 分层。
3. **搜索框用 shadcn Input + Button** — 受控 `value` 来自 `useState`；提交按钮图标 `Search`（lucide-react），含 `aria-label`；Enter 键与点击均触发提交。
4. **空查询防护** — 提交时 `query.trim().length === 0` 则不调用 `onSearch`，input 保持可用并 `focus()`，用 `sr-only` 文案提示，避免禁用按钮造成"故障感"。
5. **响应式策略 mobile-first** — 默认（移动）文字居中 `text-5xl`、搜索框全宽堆叠；`md:` 起文字左对齐；`lg:` 标语 `text-6xl`、搜索框与按钮横排（`flex`）。高度用 `min-h-[70vh] lg:min-h-screen` 或 runtime 由 layout 控制。
6. **背景图兜底** — 外层容器固定 `bg-slate-800`（深色场景），Image 加载失败（next/image `onError` 或自然降级）时露出底色，杜绝白块。
7. **Props 默认值** — `headline` / `subheadline` / `searchPlaceholder` 在组件内提供默认值，调用方可覆盖（A/B 预留）；`onSearch` 可选，缺省时仅受控不报错。

## Risks / Trade-offs

- [Risk] `next/image` 远程域名需配置 `images.remotePatterns` → Mitigation: MVP 用 picsum/本地占位，README 与 design 标注需在 `next.config` 加域名白名单；若用本地 `public/` 图则无需配置。
- [Risk] 渐变叠层在极亮背景图上仍可能对比不足 → Mitigation: 默认 `from-black/60` 已满足 AA；后续可据真实图微调 opacity。
- [Risk] `homepage-layout` 尚未交付，组件组装位置不确定 → Mitigation: 本 change 组件自带可独立渲染 Demo（测试/story），layout 仅负责插槽，不侵入组件内部。
- [Risk] React 18 vs 19 差异 → Mitigation: 组件仅用通用 hooks（`useState`），18/19 兼容，以项目基线 React 19 为准。

## Migration Plan

1. 批准本 change（proposal + design + tasks 签字）。
2. 在 `frontend/` 子仓实现 `components/homepage/hero.tsx` + 测试（TDD：先写失败测试）。
3. `homepage-layout` change 交付后，在 `app/page.tsx` 的 Hero 插槽消费本组件并联调。
4. 归档时把 `openspec/specs/homepage-hero.md` 作为稳定 spec 纳入主 specs（已是真相来源，本 change 不新增主 spec 文件，仅引用）。

## Open Questions

- 背景图来源：MVP 用 picsum 占位还是预置本地图？→ 默认 picsum，URL 经 Props 传入便于切换。
- `onSearch` 落地形式（跳转 `/search?q=` 还是调用 AI 对话）由后续 change 决定，本 change 不动。
