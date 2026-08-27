# homepage-hero Specification

## Purpose
TBD - created by archiving change homepage-hero. Update Purpose after archive.
## Requirements
### Requirement: Hero 视觉与文案渲染
首页 SHALL 在首屏渲染全幅品牌背景图、品牌标语 "Discover China Like a Local" 与副标题 "Your AI-powered travel companion for exploring China"，并通过叠层渐变保证白字可读性。

#### Scenario: 正常加载首屏
- **WHEN** 用户访问首页根路由 `/`
- **THEN** Hero 区在首屏可见，全幅背景图覆盖视口顶部区块
- **AND** 背景图上方叠加 `from-black/60 to-transparent` 渐变层，标语与副标题白字清晰可读
- **AND** 渲染标语与副标题，且搜索框显示 placeholder "Search destinations, tips, or ask AI..."

#### Scenario: 背景图加载失败
- **WHEN** `next/image` 背景图资源 404 或网络失败
- **THEN** Hero 区显示兜底背景色 `bg-slate-800`（深色场景）避免白块
- **AND** 文字叠层与文案仍正常渲染、保持可读

#### Scenario: 移动端窄屏渲染
- **WHEN** 视口宽度 < `md` (768px)
- **THEN** 文字内容居中对齐，标语使用 `text-5xl`，搜索框全宽堆叠在文案下方
- **AND** 背景图保持 `fill` 覆盖且 `object-cover` 不被拉伸变形

#### Scenario: 桌面端宽屏渲染
- **WHEN** 视口宽度 ≥ `lg` (1024px)
- **THEN** 文字左对齐、垂直居中于左侧内容区，标语使用 `text-6xl`
- **AND** 搜索框与提交按钮横向排列（input + button inline）

### Requirement: 搜索框交互
Hero 搜索框 SHALL 为受控输入，非空查询提交时通过 `onSearch` 回调向上抛出 trim 后的查询字符串；本单元不实现搜索结果页或 AI 调用。

#### Scenario: 用户输入并提交
- **WHEN** 用户在搜索框输入非空查询并点击提交按钮（或按 Enter）
- **THEN** 组件调用 `props.onSearch(query)` 回调并传入 trim 后的查询字符串
- **AND** 搜索框 input 保持受控（value 由 `useState` 管理）

#### Scenario: 空查询提交
- **WHEN** 用户未输入任何内容（或仅空格）即点击提交
- **THEN** 组件 SHALL NOT 调用 `onSearch`
- **AND** 提交按钮保持可用状态，可对 input 施加 `focus` 与 `sr-only` 提示 "Please enter a search term"

#### Scenario: 键盘可达性
- **WHEN** 用户使用 Tab 键聚焦到搜索框与提交按钮
- **THEN** 两个元素均显示 `focus-visible` ring
- **AND** 提交按钮含可访问名称（`aria-label="Search"` 或可见文字 "Search"）

### Requirement: Hero 组件 Props 契约
Hero 组件 SHALL 通过强类型 `HeroProps` 接收配置，所有字段强类型、无 `any`。

#### Scenario: Props 默认值覆盖
- **WHEN** 调用方传入 `headline` / `subheadline` / `searchPlaceholder`
- **THEN** 组件渲染传入值而非默认值
- **AND** 调用方未传入时，组件使用 spec 定义的英文默认文案

#### Scenario: 背景图经 Props 传入
- **WHEN** 调用方传入 `backgroundImageUrl`
- **THEN** 组件以 `next/image` `fill` + `priority` 渲染该图
- **AND** `backgroundImageAlt` 可选，背景图默认 `aria-hidden`（装饰性）

