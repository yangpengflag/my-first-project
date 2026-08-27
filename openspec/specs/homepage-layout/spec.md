# homepage-layout Specification (DEPRECATED)

> **历史归档**：本 spec 由早期 change `homepage-layout` 归档，其区域命名（platformNav / destinations / community）与"布局根壳 + RegionState 四态"理念已被新划分 **`homepage-shell`** 取代。新开发请以 `openspec/specs/homepage-shell/spec.md` 为准；本文件仅作历史追溯保留。

## Purpose
TBD - created by archiving change homepage-layout. Update Purpose after archive.
## Requirements
### Requirement: 首页布局根壳与插槽顺序
首页 SHALL 由 `HomepageLayout` 根壳组装，按固定顺序渲染区域：Hero → PlatformNav → Destinations → Community；AI 悬浮入口（AIFab）为独立挂载点，不参与流布局。

#### Scenario: Hero 为全幅首屏
- **WHEN** 渲染 `HomepageLayout` 且传入 `hero` 插槽
- **THEN** Hero 区域位于页面最顶部，全幅宽度（不套 `max-w-6xl` 容器）

#### Scenario: 内容区域顺序与容器
- **WHEN** 传入 `platformNav` / `destinations` / `community` 插槽
- **THEN** 三者按 PlatformNav → Destinations → Community 顺序出现
- **AND** 每个区域包裹 `<section data-region>` 并套 `mx-auto max-w-6xl px-6` 响应式容器

### Requirement: Section 间距由全局 token 驱动
各内容区域 SHALL 使用全局 `--spacing-section`（desktop 96px）/ `--spacing-section-mobile`（mobile 64px）变量控制垂直间距，不写死 padding 值。

#### Scenario: 间距变量应用
- **WHEN** 浏览器渲染内容区域 `<section data-region>`
- **THEN** 其 `padding-block` 解析为 `var(--spacing-section)`（移动端 `var(--spacing-section-mobile)`）

### Requirement: 四态兜底复用组件
布局 SHALL 提供 `RegionState` 组件，支持 `loading` / `content` / `empty` / `error` 四态，供数据型区域（destinations / community）复用。

#### Scenario: loading 态
- **WHEN** `status="loading"`
- **THEN** 渲染 shadcn `Skeleton` 组合的卡片/列表骨架屏

#### Scenario: empty 态
- **WHEN** `status="empty"`
- **THEN** 渲染居中 lucide 图标 + 引导文案 + 可选 CTA 按钮

#### Scenario: error 态
- **WHEN** `status="error"`
- **THEN** 渲染错误描述 + 重试操作（`onRetry` 回调）

#### Scenario: content 态
- **WHEN** `status="content"`
- **THEN** 直接渲染 children 内容

### Requirement: Hero 在首页真实联调
`app/page.tsx` SHALL 通过 `HomepageLayout` 的 hero 插槽挂载已实现并验证过的 `<Hero>` 组件，使首屏可见。

#### Scenario: 首页首屏可见 Hero
- **WHEN** 用户访问 `/`
- **THEN** 首屏显示 Hero 全幅背景图、标语、副标题与 AI 搜索框

