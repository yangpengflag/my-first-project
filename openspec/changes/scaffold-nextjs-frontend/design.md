## Context

`frontend/` 子仓当前是 Vue 3 + Vite 临时脚手架（`frontend-temp`），与已签字的 `tech-stack` spec（Next.js 14 + React + TypeScript）冲突，且阻塞 `homepage-hero` 等 feature change。本 change 将子仓重建为 Next.js 14 App Router 脚手架，建立 Tailwind 4 + shadcn/ui + Vitest/RTL 基线，为后续首页各区域单元提供可独立开发/测试/交付的环境。

样式与工具链约束来自两处真相：
- `tech-stack` spec（Next.js 14、React 19、TS 5、Node ≥20.19、Vercel 部署）
- `always_applied_workspace_rules`（Tailwind 4 + shadcn base-nova、lucide-react、Inter/Plus Jakarta Sans 字体、禁止库清单）

## Goals / Non-Goals

**Goals:**
- 交付一个可 `npm run dev` / `build` / `test` 通过的 Next.js 14 脚手架。
- 预置 Tailwind 4 + shadcn/ui（base-nova / neutral）与 lucide-react。
- 预置 Vitest + RTL + jsdom 测试能力与一个冒烟测试。
- 注入 Inter + Plus Jakarta Sans 字体 CSS 变量，h1–h6 自动应用标题字体。

**Non-Goals:**
- 不实现任何业务页面/组件（首页各区域走独立 change）。
- 不接入后端 API、不配置 CORS/代理（后续 change）。
- 不做暗色模式全面启用（仅保留 class 策略与 `.dark` token 位，按需扩展）。

## Decisions

1. **创建方式**：用 `create-next-app` 非交互生成 App Router + TS + Tailwind + ESLint 骨架，再叠加 shadcn 与测试栈，避免手写配置漂移。若网络受限则用 `npx`，必要时手动写最小 `package.json` + 配置文件。
2. **清空 Vue 临时文件**：删除 `index.html`、`src/`、`vite.config.ts`、`vitest.config.ts`、`tsconfig.app.json`、`tsconfig.node.json`、`tsconfig.vitest.json` 及 Vue 相关 devDeps；保留 `public/`（如有占位资源可留）、`.gitignore`、`.git`。
3. **Tailwind 4**：使用 `@import "tailwindcss";` 在 `app/globals.css`，不写旧版 `tailwind.config.js` 的 content 数组（v4 零配置）；如需自定义 token 用 `@theme` 注入 CSS 变量。
4. **shadcn/ui**：执行 `shadcn init`（base-nova / neutral），`components.json` 产出；预置 `Button`、`Input` 组件（homepage-hero 直接复用）。
5. **字体**：`next/font/google` 加载 Inter（`--font-sans`）与 Plus Jakarta Sans（`--font-heading`），在根 `layout.tsx` 注入 `<body>` 的 CSS 变量；全局 CSS 让 `h1..h6 { font-family: var(--font-heading) }`。
6. **测试栈**：安装 `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` + `@vitejs/plugin-react`；`vitest.config.ts` 设 `environment: jsdom`、`globals: true`、setup 文件引入 jest-dom。写一个 `app/page.test.tsx` 冒烟测试（渲染占位首页、断言存在标题文本）。
7. **禁止库**：`package.json` 不引入 styled-components / emotion / MUI / Ant Design / Chakra；若 create-next-app 默认带的不相关依赖清理掉。
8. **Node 引擎**：`engines.node`: ">=20.19"，与 `tech-stack` 对齐。

## Deviations (已修正的事实偏差)

- **React 版本：spec 写 "React 19"，实际落为 React 18。** `tech-stack` spec 将前端栈写为 "React 19 + Next.js 14"，但 Next.js 14.2.x 的 peer 依赖强制为 `react@^18.2.0`，**React 19 不被 Next 14 支持**（React 19 需 Next 15）。在 "Next.js 14 为硬约束" 的前提下，采用 React 18.3.1（官方稳定组合），所有首页功能需求均可满足。`@types/react` 同步为 ^18。此偏差应在 `tech-stack` spec 同步修订。
- **Tailwind 4 通过 `@tailwindcss/postcss` 接入**（非 v3 的 `tailwindcss` 插件），`globals.css` 用 `@import "tailwindcss"` + `@theme` 注入 token，无 `tailwind.config.ts`。

## Risks / Trade-offs

- [Risk] `create-next-app` 需要联网且可能交互卡住 → Mitigation: 全程非交互参数（`--yes` / `--no-eslint` 视情况），或离线手写最小骨架。
- [Risk] shadcn init 需指定 base color（neutral）与样式路径 → Mitigation: 按 `components.json` 规范显式配置，路径对齐 `app/` + `components/`。
- [Risk] 清空 Vue 文件误删重要资源 → Mitigation: 执行前 `git status` 确认干净，仅删已知临时脚手架文件，`public/` 保留。
- [Risk] Vitest 与 Next 的 SWC/ESM 冲突 → Mitigation: 使用 `@vitejs/plugin-react` + `jsdom`，测试文件用 `.test.tsx`，不依赖 Next 运行时。

## Migration Plan

1. 批准本 change（proposal + design + tasks 签字）。
2. 在 `frontend/` 子仓执行清空 + `create-next-app` + shadcn + 测试栈（TDD：先有冒烟测试失败→补脚手架→通过）。
3. 子仓独立 `git add/commit/push`。
4. 父仓 `git add frontend` 更新 submodule 指针，commit。
5. 归档本 change，`frontend-nextjs-scaffold` 成为主 spec。
6. 回到 `homepage-hero` 执行 `/opsx:apply homepage-hero`。

## Open Questions

- 是否保留 `frontend-temp` 的 `public/` 资源？→ 默认保留，无业务资源则清空。
- shadcn base-nova 主题是否需要额外主题包？→ 按 shadcn 官方 init 流程拉取 neutral，base-nova 作为自定义基础按需覆盖。
