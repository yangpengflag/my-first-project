# Spec: Homepage Hero 区（homepage-hero）

> 所属页面：WanderChina 首页（`frontend/app/page.tsx` 的首屏区域）
> 技术基线：Next.js 14 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (base-nova)
> 状态：DRAFT（待人类签字后进入 `/opsx:apply`）

---

## 1. 模块边界（Module Boundary）

### 1.1 本单元包含（In Scope）

- 首页首屏全幅 Hero 区块的视觉与交互实现，作为 `homepage-layout` 提供的 `<Section slot="hero">` 插槽内容。
- 全幅品牌主视觉背景图（使用 `next/image` 的 `fill` + `priority` 优化，覆盖视口宽度）。
- 文字层级：品牌标语 `Discover China Like a Local` + 副标题 `Your AI-powered travel companion for exploring China`，遵循样式规约的 Hero 排版节奏（大标题 `text-5xl lg:text-6xl` bold white，副标题 `text-base`/`text-lg` slate 系 + 叠层渐变兜底）。
- 文字可读性叠层：`bg-gradient-to-r from-black/60 to-transparent`（左重右轻）确保白字对比度 ≥ 4.5:1（WCAG AA）。
- AI 搜索框：受控输入，placeholder `Search destinations, tips, or ask AI...`，含提交按钮（`Search` 图标，lucide-react）。
- 提交行为：通过 `onSearch` 回调向上抛出查询字符串；本单元**不实现**搜索结果页或 AI 调用逻辑，仅做 UI 与受控状态。
- 响应式：mobile-first，背景图与文字在 `md:` / `lg:` 断点渐进增强；移动端文字居中、桌面端左对齐。
- 无障碍：可聚焦元素保留 `focus-visible` ring；搜索框含 `<label>`（可见或 `sr-only`）；装饰性背景图 `aria-hidden="true"`。

### 1.2 本单元不包含（Out of Scope）

- 搜索结果页 / 路由跳转目标（由后续搜索功能 change 实现，`onSearch` 仅预留签名）。
- AI 能力接入（真实调用、流式回复、意图识别）——属于 `homepage-ai-fab` 与搜索后端 change。
- 三大平台入口导航卡片（→ `homepage-platform-nav`）。
- 热门目的地 / 社区精选 / AI 悬浮窗（→ 各自独立 spec）。
- Loading/Empty/Error 四态：Hero 为纯静态首屏，无异步数据，**不适用**四态（与 `homepage-layout` 约定的四态仅作用于数据型区域）。
- 字体体系注入（Inter / Plus Jakarta Sans）由全局 layout 与 `next/font` 提供，本单元仅消费 CSS 变量。

---

## 2. 核心场景（Core Scenarios）

> 格式遵循 OpenSpec RFC2119：`SHALL` 表示强制。场景以 WHEN/THEN/AND 描述，覆盖正常路径与异常路径。

### Requirement: Hero 视觉与文案渲染

#### Scenario: 正常加载首屏（正常路径）
- **WHEN** 用户访问首页根路由 `/`
- **THEN** Hero 区在首屏可见，全幅背景图覆盖视口顶部区块（高度 ≥ `min-h-[70vh]` 或 `lg:min-h-screen` 约定值）
- **AND** 背景图上方叠加 `from-black/60 to-transparent` 渐变层，标语与副标题白字清晰可读
- **AND** 渲染标语 "Discover China Like a Local" 与副标题 "Your AI-powered travel companion for exploring China"
- **AND** 搜索框显示 placeholder "Search destinations, tips, or ask AI..."

#### Scenario: 背景图加载失败（异常路径）
- **WHEN** `next/image` 背景图资源 404 或网络失败
- **THEN** Hero 区显示兜底背景色 `bg-slate-800`（深色场景）避免白块
- **AND** 文字叠层与文案仍正常渲染、保持可读

#### Scenario: 移动端窄屏渲染（响应式路径）
- **WHEN** 视口宽度 < `md` (768px)
- **THEN** 文字内容居中对齐，标语使用 `text-5xl` 字号，搜索框全宽堆叠在文案下方
- **AND** 背景图保持 `fill` 覆盖且不被拉伸变形（object-cover）

#### Scenario: 桌面端宽屏渲染（响应式路径）
- **WHEN** 视口宽度 ≥ `lg` (1024px)
- **THEN** 文字左对齐、垂直居中于左侧内容区，标语使用 `text-6xl` 字号
- **AND** 搜索框与提交按钮横向排列（input + button inline），位于文案下方

### Requirement: 搜索框交互

#### Scenario: 用户输入并提交（正常路径）
- **WHEN** 用户在搜索框输入非空查询并点击提交按钮（或按 Enter）
- **THEN** 组件调用 `props.onSearch(query)` 回调并传入 trim 后的查询字符串
- **AND** 搜索框 input 保持受控（value 由 `useState` 管理，清空或不清空由父级决定，本单元默认不清空）

#### Scenario: 空查询提交（异常路径）
- **WHEN** 用户未输入任何内容（或仅空格）即点击提交
- **THEN** 组件 SHALL NOT 调用 `onSearch`
- **AND** 提交按钮保持可用状态（不禁用，避免误以为故障），可对 input 施加 `focus` 提示或 `aria-describedby` 错误文案（本单元可选实现，建议 `sr-only` 提示 "Please enter a search term"）

#### Scenario: 键盘可达性（无障碍路径）
- **WHEN** 用户使用 Tab 键聚焦到搜索框与提交按钮
- **THEN** 两个元素均显示 `focus-visible` ring（shadcn 默认）
- **AND** 提交按钮含可访问名称（图标按钮配 `aria-label="Search"` 或可见文字 "Search"）

---

## 3. 数据结构（Data Structures）

### 3.1 组件 Props 定义

```ts
// frontend/components/homepage/hero.tsx
import type { ComponentProps } from "react";

export interface HeroProps {
  /**
   * 品牌背景图。MVP 阶段为静态 URL（如 picsum 占位或真实图）。
   * 必须可通过 next/image 的 fill 模式渲染（提供 src 即可，无需 width/height）。
   */
  backgroundImageUrl: string;

  /**
   * 背景图 alt 描述（内容性图片需提供；本单元背景为装饰性，
   * 组件内部对 next/image 设 aria-hidden，但保留 alt 字段以备真实图切换）。
   */
  backgroundImageAlt?: string;

  /**
   * 品牌标语。默认 "Discover China Like a Local"，允许调用方覆盖（A/B 测试预留）。
   */
  headline?: string;

  /**
   * 副标题。默认 "Your AI-powered travel companion for exploring China"。
   */
  subheadline?: string;

  /**
   * 搜索框占位符。默认 "Search destinations, tips, or ask AI..."。
   */
  searchPlaceholder?: string;

  /**
   * 提交回调。非空查询时触发，参数为 trim 后字符串。
   * 父级负责路由跳转或调用 AI；本单元不实现具体逻辑。
   * REQUIRED：缺省时搜索框仅做受控输入，不抛错（建议父级必传）。
   */
  onSearch?: (query: string) => void;

  /**
   * 透传 className，用于 layout 插槽覆盖间距/高度（如 min-h 调整）。
   */
  className?: ComponentProps<"section">["className"];
}
```

### 3.2 约束（Constraints）

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `backgroundImageUrl` | `string` (URL) | 是 | 非空；建议 `https` 源以兼容 Next Image 优化域名白名单 |
| `backgroundImageAlt` | `string` | 否 | 默认空；组件内部背景图标 `aria-hidden` |
| `headline` | `string` | 否 | 默认 "Discover China Like a Local"；限长建议 ≤ 40 字符 |
| `subheadline` | `string` | 否 | 默认 "Your AI-powered travel companion for exploring China" |
| `searchPlaceholder` | `string` | 否 | 默认 "Search destinations, tips, or ask AI..." |
| `onSearch` | `(q: string) => void` | 否 | 非空查询（trim 后 length>0）才调用 |
| `className` | `string` | 否 | 仅追加，不覆盖布局核心类 |

### 3.3 内部状态（组件内 `useState`，不对外暴露）

- `query: string` —— 受控输入值。

### 3.4 样式 Token 引用（来自全局 CSS 变量 / Tailwind）

- 品牌色按钮：`bg-blue-700 hover:bg-blue-800 text-white`（提交按钮，若用 shadcn `Button` 则 `variant` 取默认 + 自定义类）
- 区块高度：由 `homepage-layout` 的 Section 间距变量控制，本单元不自定义 `padding-block`
- 文字颜色：标语/副标题 `text-white`，依赖叠层渐变保证对比度

---

## 4. 验收标准（Acceptance Checklist）

> 实现完成后逐条勾选；TDD 阶段先写失败测试覆盖以下可测项。

### 视觉与渲染
- [ ] Hero 区在 `/` 首屏可见，背景图 `next/image` 以 `fill` + `priority` 渲染，无布局抖动（CLS ≈ 0）
- [ ] 标语 "Discover China Like a Local" 与副标题 "Your AI-powered travel companion for exploring China" 正确渲染
- [ ] 白字叠加 `from-black/60 to-transparent` 渐变层，手动/工具校验对比度 ≥ 4.5:1
- [ ] 背景图加载失败时显示 `bg-slate-800` 兜底，无白块

### 搜索框
- [ ] placeholder 为 "Search destinations, tips, or ask AI..."
- [ ] 输入非空并回车/点击 → 调用 `onSearch(trimmedQuery)`
- [ ] 输入为空或纯空格 → **不**调用 `onSearch`，input 保持可用
- [ ] 提交按钮含可访问名称（`aria-label="Search"` 或可见 "Search" 文字）

### 响应式
- [ ] `<md`：文字居中、`text-5xl`、搜索框全宽堆叠
- [ ] `≥lg`：文字左对齐、`text-6xl`、搜索框与按钮横向排列
- [ ] 任意断点下背景图 `object-cover` 不被拉伸变形

### 无障碍
- [ ] 搜索框与按钮可 Tab 聚焦且显示 `focus-visible` ring
- [ ] 装饰性背景图 `aria-hidden="true"`
- [ ] 搜索框关联 `<label>`（可见或 `sr-only`）

### 技术约束
- [ ] 组件位于 `frontend/components/homepage/hero.tsx`（或 layout 约定目录）
- [ ] 使用 shadcn/ui `Button` / `Input`，未引入原生 `<input>`/`<button>` 或禁止的组件库
- [ ] 图标来自 lucide-react（`Search`），未混用其他图标库
- [ ] 使用 `next/image` 优化背景图，未用裸 `<img>`
- [ ] TypeScript 通过 `tsc --noEmit`，无 `any` 逃逸（Props 强类型）
- [ ] 单元测试（Vitest + RTL）覆盖：空查询不触发 onSearch、非空触发 onSearch、背景图降级兜底
- [ ] 通过 `homepage-layout` 插槽组装后在首页正确呈现（联调）

---

## 5. 依赖关系（Dependencies）

- **依赖**：`homepage-layout`（提供 Section 插槽顺序、间距 token、响应式容器约定）；全局 `next/font` 字体变量；Tailwind/shadcn 主题。
- **被依赖**：首页组装页 `app/page.tsx` 消费本单元作为首屏。
- **与其他单元关系**：无强耦合。搜索框 `onSearch` 的落地（路由/AI）由后续独立 change 实现，本单元仅预留回调签名。

## 6. 非目标确认（YAGNI）

- 不做搜索自动补全、热门词联想（后续 change）。
- 不做多语言 i18n（文案暂写死英文，预留覆盖参数）。
- 不做背景图轮播 / parallax / 视差动效（留独立 change）。
