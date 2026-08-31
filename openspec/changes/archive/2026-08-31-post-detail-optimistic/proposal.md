## Why

`post-detail-engagement`（已归档）在详情页落地了评论区、投票、收藏三套互动 UI，但其 design.md **D6 明确把乐观更新列为"首版不做、留作后续优化"**——当前实现是 *请求后更新* 模型：每次投票/收藏/发评论都要等网络返回才刷新 UI，期间按钮 `disabled` + `Loader2` 旋转，存在明显感知延迟。后端三 capability 的写操作均为幂等的 toggle / upsert，前端数据结构也已就绪，已具备零契约变更地升级为乐观更新的条件。本 change 将三组件升级为「乐观更新 + latest-wins 竞态守卫 + 失败瞬时回滚提示」，显著改善互动手感，且不引入新依赖、不改组件名、不动后端。

## What Changes

- **更新模型升级（三组件）**：`VotePanel` / `BookmarkButton` / `CommentSection`（含 `CommentItem`）由"请求后更新"改为"乐观更新"。交互期间以本地 state 为唯一真相源，点击即翻转 UI 并异步发起 API；响应回来后与本地态对账（仅采纳最新一次请求的响应）。
- **失败回滚**：请求失败时回滚到点击前快照，并以**瞬时可关闭的 `Alert`**（销毁式，约 4s 自动消失或手动关）提示"操作未成功，请重试"；仅在不可自愈的错误时才退化为现有整块 error 四态 `Alert`。**不引入 toast / sonner 等新依赖**，复用既有 `Alert` 组件。
- **竞态处理**：**不禁用按钮**（保留乐观手感），允许快速连点；用 `useRef` 自增 `reqId` 做 latest-wins 守卫，丢弃过期响应，避免乱序覆盖。
- **评论乐观插入**：发布顶层评论 / 回复时本地先插入带临时 id（`temp-${Date.now()}-${rand}`）与 `pending` 标记的条目；成功用服务端返回实体替换临时项，失败移除临时项并提示。
- **无契约变更**：三个写操作（`POST /vote`、`POST /bookmark`、`POST /comments`）已存在且签名不变，`openapi.json` / `api.generated.ts` 无需重新 sync；`ErrorCode` 联合已含所需错误码。

无 **BREAKING** 变更（仅改造既有前端组件内部更新逻辑；不改对外 API、不改组件导出名、不改后端）。

## Capabilities

### New Capabilities

- 无新增 capability。

### Modified Capabilities

- `post-detail-engagement`：互动组件的更新模型由"请求后更新"升级为"乐观更新"（范围不变，仅内部行为升级）。
- 契约：无变更（前端无需重新 pull `openapi.json`）。

## Impact

- 改动文件：`app/posts/_components/VotePanel.tsx`、`BookmarkButton.tsx`、`CommentSection.tsx`、`CommentItem.tsx`（逻辑改造）；对应 `*.test.tsx` 扩展乐观路径断言。
- 可能新增：`lib/engagement/useOptimisticAction.ts`（封装 reqId 守卫 + 快照 + 回滚 + 瞬时 Alert 状态，供三组件复用，避免重复）。最终是否抽共享 hook 由 design D7 决定。
- 不改动 `lib/comments|votes|bookmarks/{api,types,messages}.ts`（纯乐观层，不影响 API 封装）。
- 依赖：既有 `useAuthSession`、`components/ui/alert`、`lucide`、现有 session；不新增依赖。
- 测试：Vitest + RTL 覆盖——点击立即可见 UI 变化（不等待 await）、失败回滚 + 提示、快速连点 latest-wins、评论临时 id 对账；`npm run type-check` → `test` → `build` 全绿。
- 样式：遵循 style 规约（Tailwind / shadcn / blue-700 / 四态 / 无障碍；回滚提示需 `aria-live="polite"`）。
