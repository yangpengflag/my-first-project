## 1. 脚手架与契约

- [x] 1.1 在 `frontend/components/homepage/` 创建 `hero.tsx`，导出 `HeroProps` 接口与 `Hero` 组件（默认导出或命名导出，与项目约定一致）。
- [x] 1.2 定义 `HeroProps`：`backgroundImageUrl: string`（必填）、`backgroundImageAlt?`、`headline?`、`subheadline?`、`searchPlaceholder?`、`onSearch?`、`className?`，全部强类型，无 `any`。
- [x] 1.3 组件内为 `headline`/`subheadline`/`searchPlaceholder` 设置默认值（与 spec 文案一致），`onSearch` 缺省时不抛错。

## 2. 视觉与响应式实现

- [x] 2.1 外层 `relative` 容器 + 固定兜底底色 `bg-slate-800`，内部 `next/image` 以 `fill priority object-cover` 渲染背景图，装饰性 `aria-hidden`。
- [x] 2.2 叠 `absolute inset-0 bg-gradient-to-r from-black/60 to-transparent` 可读性层，文字居其上（z-index 分层）。
- [x] 2.3 渲染标语（`text-5xl lg:text-6xl font-bold text-white`）与副标题（`text-base lg:text-lg text-white/90`）。
- [x] 2.4 响应式：默认移动端文字居中、搜索框全宽堆叠；`md:` 起左对齐；`lg:` 标语 `text-6xl`、搜索框与按钮横排 `flex`。
- [x] 2.5 高度由 `min-h-[70vh] lg:min-h-screen`（或 layout 经 `className` 覆盖），避免 CLS。

## 3. 搜索框交互

- [x] 3.1 使用 shadcn `Input` + `Button`，受控 `value` 由 `useState` 管理。
- [x] 3.2 提交按钮含 lucide `Search` 图标 + `aria-label="Search"`（或可见文字）。
- [x] 3.3 点击与 Enter 均触发提交：`query.trim().length > 0` 时调用 `onSearch(trimmed)`；空查询不调用、input `focus()` 并 `sr-only` 提示。
- [x] 3.4 可 Tab 聚焦元素显示 `focus-visible` ring（shadcn 默认）；搜索框关联 `<label>`（`sr-only` 可见）。

## 4. 测试（TDD，先红后绿）

- [x] 4.1 用 Vitest + RTL 写失败测试：渲染默认文案与 placeholder。
- [x] 4.2 测试：输入非空并回车/点击 → `onSearch` 被调用且参数为 trim 后字符串。
- [x] 4.3 测试：空查询提交 → `onSearch` 不被调用，input 仍可用。
- [x] 4.4 测试：背景图容器含 `bg-slate-800` 兜底类（降级场景）。
- [x] 4.5 运行 `npm run test` 全绿，运行 `tsc --noEmit` 无类型错误。

## 5. 集成与校验

- [x] 5.1 `frontend` 子仓 `npm run build` 通过（含 next/image 优化、lint）。
- [x] 5.2 可视化验证：经 `homepage-layout` 在 `app/page.tsx` 挂载 `<HomeHero />`（Hero 客户端包装），首页首屏可见 Hero 全幅背景图、标语、副标题与搜索框（build 静态预渲染验证通过）。
- [x] 5.3 `homepage-layout` 就绪后，在 `app/page.tsx` 的 Hero 插槽消费 `<Hero>` 组件，联调首屏呈现（用 `<HomeHero />` client 包装规避 Server→Client 函数 prop 限制）。
- [x] 5.4 运行 `openspec validate homepage-hero` 确认 change 制品合规。

## 6. 交付

- [ ] 6.1 在 `frontend/` 子仓提交（按 submodule 规范独立 commit/push）。
- [ ] 6.2 父仓更新 submodule 指针（如已改动）。
- [ ] 6.3 `/opsx:archive` 归档本 change，将 `openspec/specs/homepage-hero.md` 固化为主 spec。
