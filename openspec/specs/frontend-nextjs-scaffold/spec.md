# frontend-nextjs-scaffold Specification

## Purpose
TBD - created by archiving change scaffold-nextjs-frontend. Update Purpose after archive.
## Requirements
### Requirement: 前端脚手架为 Next.js 14
`frontend/` 子仓 SHALL 是基于 Next.js 14 (App Router) + React 18 + TypeScript 5 的前端工程，取代原 Vue 3 临时脚手架。Vue 3 / Nuxt 3 SHALL NOT 使用。（注：React 18 为 Next.js 14 强制 peer；React 19 需 Next 15，故本栈锁定 React 18。）

#### Scenario: 脚手架可启动与构建
- **WHEN** 开发者在 `frontend/` 执行 `npm run dev`
- **THEN** 开发服务器启动且无编译错误
- **AND** 执行 `npm run build` 产出 `.next/` 构建产物

#### Scenario: 不残留 Vue 依赖
- **WHEN** 检查 `frontend/package.json` 的依赖
- **THEN** 不包含 `vue` / `vue-router` / `pinia` / `vite`(作为主构建) 等 Vue 栈包

### Requirement: 样式与组件库为 Tailwind 4 + shadcn/ui
前端 SHALL 使用 Tailwind CSS 4（`@import "tailwindcss"`）+ shadcn/ui（base-nova 主题 / neutral）作为样式栈，图标统一来自 lucide-react。

#### Scenario: shadcn 组件可用
- **WHEN** 开发者导入 `components/ui/button` 与 `components/ui/input`
- **THEN** 可正常使用 `Button` 与 `Input` 组件（无样式/类型错误）

#### Scenario: 图标来源统一
- **WHEN** 页面需要图标
- **THEN** 仅从 `lucide-react` 引入，不混用其他图标库

### Requirement: 测试栈为 Vitest + RTL
前端 SHALL 使用 Vitest + React Testing Library + jsdom 进行单元/组件测试，禁止引入与原 Vue 栈相关的测试工具。

#### Scenario: 测试可运行
- **WHEN** 开发者执行 `npm run test`
- **THEN** 测试套件运行且内置冒烟测试通过

### Requirement: 字体体系注入
前端 SHALL 通过 `next/font/google` 加载 Inter（正文 `--font-sans`）与 Plus Jakarta Sans（标题 `--font-heading`），并以 CSS 变量注入全局。

#### Scenario: 标题字体自动应用
- **WHEN** 渲染任意 `h1`–`h6` 元素
- **THEN** 其 `font-family` 解析为 `var(--font-heading)`（Plus Jakarta Sans）

### Requirement: 禁止库清单
前端 SHALL NOT 引入 styled-components / emotion / vanilla-extract / MUI / Chakra / Ant Design 等被样式规约禁止的库。

#### Scenario: 依赖审计
- **WHEN** 检查 `frontend/package.json`
- **THEN** 不存在上述禁止库的依赖项

