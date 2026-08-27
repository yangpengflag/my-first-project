## 1. 清空 Vue 临时脚手架

- [ ] 1.1 确认 `frontend/` 子仓 `git status` 干净、在 `main` 分支；备份性检查无需 commit 的内容。
- [ ] 1.2 删除 Vue 临时文件：`index.html`、`src/`、`vite.config.ts`、`vitest.config.ts`、`tsconfig.app.json`、`tsconfig.node.json`、`tsconfig.vitest.json`、`package.json`、`package-lock.json`、`README.md`（Vue 版）。
- [ ] 1.3 保留 `.git`、`gitignore`、`public/`（若有），其余清理。

## 2. 初始化 Next.js 14 脚手架

- [ ] 2.1 用 `create-next-app` 非交互生成：App Router + TypeScript + Tailwind + ESLint + `src/` 关闭（用 `app/` 顶层，与 workspace 规约一致）、import alias `@/*`。
- [ ] 2.2 确认生成 `app/layout.tsx`、`app/page.tsx`、`next.config.*`、`tsconfig.json`、`package.json`、`postcss.config.*`。
- [ ] 2.3 `package.json` 设置 `engines.node: ">=20.19"`，`scripts` 含 `dev`/`build`/`start`/`lint`/`test`。

## 3. 接入 Tailwind 4 + shadcn/ui + lucide

- [ ] 3.1 `app/globals.css` 使用 `@import "tailwindcss";` 与 `@theme`（如需自定义 token），移除旧版 config 依赖。
- [ ] 3.2 执行 `shadcn init`（base-nova / neutral），生成 `components.json`、`lib/utils.ts`、`components/ui/*`。
- [ ] 3.3 预置 `Button` 与 `Input` 组件（homepage-hero 复用）。
- [ ] 3.4 安装 `lucide-react` 作为统一图标来源。

## 4. 字体与全局样式

- [ ] 4.1 根 `layout.tsx` 用 `next/font/google` 加载 Inter（`--font-sans`）与 Plus Jakarta Sans（`--font-heading`），注入 `<body>` 变量。
- [ ] 4.2 全局 CSS 让 `h1..h6` 自动应用 `var(--font-heading)`；body 应用 `var(--font-sans)`。

## 5. 测试栈（Vitest + RTL）

- [ ] 5.1 安装 `vitest`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`、`@vitejs/plugin-react`。
- [ ] 5.2 新增 `vitest.config.ts`：`environment: jsdom`、`globals: true`、`setupFiles` 引入 jest-dom；在 `package.json` 加 `test` 脚本。
- [ ] 5.3 写冒烟测试 `app/page.test.tsx`：渲染首页断言存在占位标题文本（先红后绿）。

## 6. 校验与提交

- [ ] 6.1 `npm install` 成功，`npm run build` 通过（next/image、lint 无误）。
- [ ] 6.2 `npm run test` 全绿（含冒烟测试）。
- [ ] 6.3 `npx tsc --noEmit` 无类型错误。
- [ ] 6.4 在 `frontend/` 子仓 `git add/commit`；推送到 origin `main`（如需）。
- [ ] 6.5 父仓 `git add frontend` 更新 submodule 指针并提交。

## 7. 归档与衔接

- [ ] 7.1 `openspec validate scaffold-nextjs-frontend` 通过。
- [ ] 7.2 `/opsx:archive` 归档本 change，`frontend-nextjs-scaffold` 固化为 spec。
- [ ] 7.3 回到 `homepage-hero`：`/opsx:apply homepage-hero` 继续实现。
