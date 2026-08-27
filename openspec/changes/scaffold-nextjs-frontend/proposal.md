## Why

`tech-stack-selection` change 已将前端栈从 Vue 3 锁定为 **Next.js 14 (App Router) + React + TypeScript**，但 `frontend/` 子仓当前仍是 Vue 3 + Vite 临时脚手架（`frontend-temp`）。后续所有 feature change（如 `homepage-hero`，要求 `hero.tsx` + `next/image` + shadcn + RTL 测试）都依赖新栈才能落地。

现有 Vue 脚手架与 `tech-stack` spec 直接冲突，且阻塞 `homepage-hero` 的实现。必须先将其重建为 Next.js 14 脚手架，再回到 feature change。本 change 仅重建脚手架，**不实现任何业务功能**（业务走后续独立 change）。

## What Changes

- 清空 `frontend/` 子仓内的 Vue 3 临时脚手架文件（`index.html`、`src/`、`vite.config.ts`、`tsconfig.app.json`、`tsconfig.node.json`、`tsconfig.vitest.json`、`vitest.config.ts`、`package.json` 等），保留 `.git`、`.gitignore`。
- 用 Next.js 14 App Router 初始化新项目：`app/` 目录、`next.config`、根 `layout.tsx`、`page.tsx` 占位。React 落地为 18.3.1（Next 14 强制 peer，见 design Deviations）。
- 接入 Tailwind CSS 4（`@import "tailwindcss"`）+ shadcn/ui（base-nova 主题 / neutral）。
- 接入 lucide-react 图标库。
- 配置 Vitest + React Testing Library + jsdom 测试栈，对齐 `tech-stack` 与 workspace 样式规约的测试要求。
- 通过 `next/font/google` 注入 Inter（正文）+ Plus Jakarta Sans（标题）字体变量。
- `package.json` 增加 `dev`/`build`/`test`/`lint`/`type-check` 脚本，Node 引擎要求 ≥20.19（与 `tech-stack` 一致）。
- **不引入** styled-components / emotion / MUI / Ant Design / Chakra（样式规约禁止）。

## Capabilities

### New Capabilities
- `frontend-nextjs-scaffold`: 定义 `frontend/` 子仓的强制 Next.js 14 脚手架契约（App Router、Tailwind 4、shadcn、Vitest/RTL、字体变量、禁止库清单），作为所有前端 feature change 的基线。

### Modified Capabilities
- 取代原 Vue 3 临时脚手架状态（无对应 spec，仅为未跟踪的临时文件，故不标记 modified spec，仅物理替换）。

## Impact

- **子仓结构**：`frontend/` 从 Vue 3 变为 Next.js 14；需独立 commit/push 子仓，父仓更新 submodule 指针。
- **依赖**：Node ≥20.19（当前 v22.22.1 满足）；部署目标 Vercel（Next 原生支持）。
- **后续 change**：`homepage-hero` 等可在新栈上直接实现，不再阻塞。
- **风险**：清空 Vue 临时文件会丢失 `frontend-temp` 默认内容（无业务价值，可接受）；若子仓含未提交重要改动需先确认（当前 `git status` 干净，无风险）。
