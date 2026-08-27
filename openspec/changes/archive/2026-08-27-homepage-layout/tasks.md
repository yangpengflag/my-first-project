## 1. 布局根壳组件

- [x] 1.1 新建 `frontend/components/homepage/homepage-layout.tsx`，导出 `HomepageLayout` 组件与 `HomepageLayoutProps`（hero / platformNav / destinations / community / aiFab: ReactNode 分桶插槽）。
- [x] 1.2 Hero 插槽渲染为全幅首屏（不套 max-w 容器）；其余内容区域包裹 `<section data-region>` 并套 `mx-auto max-w-6xl px-6` 容器。
- [x] 1.3 区域顺序：Hero → PlatformNav → Destinations → Community；aiFab 为挂载点（不参与流布局）。
- [x] 1.4 在 `globals.css` 补充 `section[data-region] { padding-block: var(--spacing-section); }`（desktop）与移动端 `--spacing-section-mobile` 规则，保持 token 驱动、不写死 px。

## 2. 四态复用组件

- [x] 2.1 新建 `frontend/components/homepage/region-state.tsx`，导出 `RegionState`：`status: 'loading'|'content'|'empty'|'error'` + 各态 props。
- [x] 2.2 loading 态：shadcn `Skeleton` 组合（卡片/列表骨架屏）。
- [x] 2.3 empty 态：居中 lucide 图标 + 引导文案 + 可选 CTA；error 态：错误描述 + 重试按钮（onRetry?）。
- [x] 2.4 content 态：直接渲染 children。

## 3. Hero 联调（回补 homepage-hero 5.3）

- [x] 3.1 修改 `frontend/app/page.tsx`，用 `HomepageLayout` + `<HomeHero />`（client 包装承载 onSearch）组装，规避 Server→Client 函数 prop 序列化限制。
- [x] 3.2 `onSearch` 用占位回调（no-op + 注释预留 `/search` 路由），不实现真实逻辑。
- [x] 3.3 首页首屏可见 Hero，响应式与背景图正常（build 静态预渲染验证通过）。

## 4. 测试（TDD）

- [x] 4.1 写失败测试：布局渲染 hero 与内容插槽，断言 `max-w-6xl` 容器与 `data-region` 存在。
- [x] 4.2 测试：区域渲染顺序（Hero 在 PlatformNav 之前）。
- [x] 4.3 测试：`RegionState` 各态（loading 含 Skeleton、empty 含引导文案、error 含重试按钮、content 渲染 children）。
- [x] 4.4 `npm run test` 全绿（11 passed），`tsc --noEmit` 无类型错误。

## 5. 集成与校验

- [x] 5.1 `npm run build` 通过（含 layout 编译、lint）。
- [x] 5.2 `openspec validate homepage-layout` 通过。

## 6. 交付与衔接

- [ ] 6.1 `frontend` 子仓 commit/push。
- [ ] 6.2 父仓更新 submodule 指针 + 提交本 change 制品。
- [ ] 6.3 回补 `homepage-hero` tasks.md 的 5.3 为 `[x]`，并 `/opsx:archive homepage-hero`。
- [ ] 6.4 `/opsx:archive homepage-layout`，固化 `homepage-layout` 为主 spec。
