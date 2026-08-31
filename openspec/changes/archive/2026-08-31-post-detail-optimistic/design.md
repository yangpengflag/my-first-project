## Context

- 上游 `post-detail-engagement`（已归档）落地了三套互动 UI，design.md **D6** 记载：「首版采用『请求完成后更新 UI』的简单模型（非乐观更新）……乐观更新列为后续优化项」。本 change 即兑现该优化项。
- 后端三 capability 已交付并通过测试；写操作语义幂等（`POST /vote` 为 upsert 用户单一投票；`POST /bookmark` 为 toggle；`POST /comments` 为创建）。前端 `lib/comments|votes|bookmarks/{api,types,messages}.ts` 与 `api.generated.ts` 已含全部所需类型与错误码（`COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT` / `RATE_LIMITED` / `VALIDATION_FAILED` / `UNAUTHENTICATED` 等），**无需刷新契约**。
- 现有组件已遵循四态 + 鉴权门禁 + 错误文案（`describeXxxError`）；本 change 只改其内部"何时更新 UI"的策略，不动这些既有骨架。

## Goals / Non-Goals

**Goals:**
- 投票 / 收藏 / 评论发布（含回复）改为乐观更新：点击立即反映，网络在后台进行。
- 引入 latest-wins 竞态守卫，确保快速连点下 UI 不出现乱序/错乱。
- 失败可自愈：回滚 + 瞬时提示，不破坏已渲染内容。
- 不引入新依赖、不改组件名、不改契约、不改后端。

**Non-Goals:**
- 不做评论编辑 / 富文本 / 排序 / 筛选（属其他 change）。
- 不引入 toast / 通知系统（回滚提示复用 `Alert`）。
- 不改 `post-detail-engagement` 的组件结构（仍 `VotePanel` / `CommentSection` / `BookmarkButton`）。
- 不动后端（含限流、错误码），也不改 API 封装层。

## Decisions

### D1. 范围：三处全部乐观更新
投票、收藏、评论发布（含回复）均升级为乐观更新。vote / bookmark 为纯本地翻转，零风险；comment 需临时 id 对账，复杂度可控且是评论区最大体验痛点，故纳入同一 change，避免拆分 overhead。

### D2. 更新模型：本地态为交互期唯一真相源
交互期间以组件本地 state 为准：
- 点击 → 立即基于"当前本地值"计算下一态并 setState；同时 `fire` API（不等 await）。
- 响应回来 → 仅当该响应为"最新请求"时，用服务端权威值对账（counts / `bookmarked` / 服务端实体）；过期响应直接丢弃。
- `pending` 仅用于图标内的 `Loader2` 轻提示，**不再用于 `disabled` 整个按钮**。

### D3. 失败反馈：复用 `Alert`，瞬时可关，不引入 toast
- 回滚提示复用既有 `Alert`（variant `destructive`），**瞬态**：约 4s 自动消失，并提供手动关闭；位置贴合操作区（投票/收藏行上方、评论区顶部）。
- 仅当错误不可自愈（如网络层彻底失败且无法回滚到有效态）才退化为现有整块 error 四态 `Alert` + 重试。
- 不设新依赖（不引入 sonner / toast 库）。若后续确需全局 toast，单列独立 change 决策。

### D4. 竞态：不禁用按钮 + latest-wins 守卫
- 按钮在请求期间**保持可点击**，保留乐观手感。
- 组件持 `useRef<number> reqId`：每次交互 `const id = ++reqId.current` 并在闭包内捕获；响应回调首行 `if (id !== reqId.current) return;` 丢弃过期响应。
- vote 的 counts 计算始终基于"当前本地 state"累加，而非基于某个响应值，避免连点丢计数。

### D5. 评论乐观插入：临时 id + pending 标记对账
- `submit` / `submitReply`：构造本地项 `{ id: 'temp-...', content, author_name: user.displayName, created_at: new Date().toISOString(), pending: true, ... }`，立即插入列表首部 / 回复列表尾部。
- 成功：用服务端返回实体按 `id` 替换临时项（去除 `pending` / `temp-` 前缀）。
- 失败：按 `id` 移除临时项，并触发 D3 的瞬时 `Alert`。
- 作者信息取自 `useAuthSession().user`；`created_at` 在 reconciliation 前可临时以 `new Date()` 呈现（或显示"刚刚"），成功后以服务端值为准。
- **边界**：若请求实际成功但响应丢失（极端竞态），UI 会移除临时项导致"看似失败"。属极低概率，刷新即可由服务端重新拉取，接受此权衡（不为此引入去重查询）。

### D6. 命名：保留 `VotePanel`
不改名。`VotePanel` 已上线、有 `VotePanel.test.tsx`、被 `PostDetail` 引用；改名白改测试与 import，零功能收益，且语义上"投票面板"比 "VoteButtons" 更准确。文档别名可用 `VoteButtons`，代码保持 `VotePanel`。

### D7. 共享 hook：抽取 `lib/engagement/useOptimisticAction.ts`
三组件重复的"reqId 守卫 + 快照 + 回滚 + 瞬时 Alert 状态"逻辑建议抽为共享 hook，签名草案：
```ts
type OptAction<T> = {
  run: (optimistic: () => void, call: () => Promise<T>, onOk: (res: T) => void) => void;
  alert: string | null;          // 瞬时回滚提示文案
  dismissAlert: () => void;
};
function useOptimisticAction(): OptAction<T>;
```
组件调用 `run(乐观 setState, api 调用, 成功对账)`，失败自动 `rollback` 由调用方在 `onOk` 之外的 catch 处理（或 hook 统一 catch 触发 alert）。若实现中发现三处差异过大导致 hook 过度参数化，则退回各组件内联（YAGNI 优先）；**默认推荐抽取共享 hook**。

### D8. 测试与验证
- 扩展既有 `VotePanel.test.tsx` / `BookmarkButton.test.tsx` / `CommentSection.test.tsx`：
  - 乐观：mock API 返回 Promise 不立即 resolve，断言点击后 UI 立即变化（counts 翻转 / 图标切换 / 评论出现在列表）。
  - 回滚：API reject → 断言 UI 回到点击前 + 出现瞬时 `Alert`（含 `aria-live`）。
  - latest-wins：连续两次点击，仅最后一次响应生效。
  - 评论：断言临时 id 条目先插入、成功后被服务端实体替换、失败后被移除。
- 验证链：`npm run type-check` → `npm run test` → `npm run build`（无契约变更，无需 `openapi:drift`）。

## Risks / Trade-offs

- **[临时 id 对账丢失]** 极端的"成功但响应丢失"会让临时评论消失，需刷新恢复。接受（低频 + 可自愈）。
- **[latest-wins 丢弃过期响应]** 服务端权威 counts 始终以"最新响应"对齐，不会累计错；但若点了 UP 又点 DOWN 且两次响应乱序，中间态可能短暂以本地态呈现——属预期乐观行为。
- **[瞬时 Alert 定时器]** 4s 自动隐藏的 `setTimeout` 必须在组件卸载时 `clearTimeout`，避免内存泄漏 / 卸载后 setState。
- **[共享 hook 过度抽象风险]** D7 已设回退：若三处差异过大，退回内联，不因 DRY 牺牲可读性。
- **[无契约刷新]** 因写操作签名不变，跳过 `openapi:sync`/`gen`；但任务 0 仍须确认三端点签名未被后端改动（读 `api.generated.ts` 现有 operation 即足）。
