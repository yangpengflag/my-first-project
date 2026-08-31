## 0. 前置确认（无契约刷新）

- [x] 0.1 通读 `lib/api.generated.ts` 确认 `vote` / `toggle` / `create`(comment) 三 operation 签名与现网一致，确认无需 `openapi:sync` / `openapi:gen`。
- [x] 0.2 确认 `ErrorCode` 联合已含 `COMMENT_NOT_FOUND` / `INVALID_PARENT_COMMENT` / `RATE_LIMITED` / `VALIDATION_FAILED` / `UNAUTHENTICATED`，无需改 `lib/auth/types.ts`。

## 1. 共享乐观 hook（D7）

- [x] 1.1 新增 `lib/engagement/useOptimisticAction.ts`：`reqId` 守卫（`useRef` 自增）+ `run(optimistic, call, onOk)` + `alert` / `dismissAlert` 状态 + 4s 自动消失 `setTimeout`（卸载 `clearTimeout`）。
- [x] 1.2 单测 `useOptimisticAction.test.tsx`：latest-wins 丢弃过期响应、失败触发 alert、成功不触发 alert、alert 超时自动清空。

## 2. VotePanel 乐观化（D2 / D4）

- [x] 2.1 点击立即翻转 `user_vote` 与 counts（基于当前本地值累加），不再 `disabled` 整个按钮。
- [x] 2.2 `votesApi.vote` 异步发起；响应回来仅当 `id === reqId.current` 时用 `res.user_vote` / counts 对账。
- [x] 2.3 失败：回滚到点击前 `stats` 快照，触发瞬时 `Alert`（复用 `describeVoteError`）。
- [x] 2.4 扩展 `VotePanel.test.tsx`：乐观立即翻转、失败回滚 + alert、连点 latest-wins。

## 3. BookmarkButton 乐观化（D2 / D4）

- [x] 3.1 点击立即翻转 `bookmarked` 本地态（图标 `Bookmark` ↔ `BookmarkCheck`）。
- [x] 3.2 `bookmarksApi.toggle` 异步；latest-wins 对账 `res.bookmarked`。
- [x] 3.3 失败：回滚 + 瞬时 `Alert`（`describeBookmarkError`）。
- [x] 3.4 扩展 `BookmarkButton.test.tsx`：乐观翻转、回滚 + alert、latest-wins。

## 4. CommentSection / CommentItem 乐观插入（D5）

- [x] 4.1 `submit`：构造临时 id + `pending` 本地项，立即插入顶层列表首部；成功按 id 替换为服务端实体，失败按 id 移除 + 瞬时 `Alert`。
- [x] 4.2 `CommentItem.submitReply`：同上，插入该评论的回复列表尾部；`parent_comment_id` 指向顶层评论不变。
- [x] 4.3 临时项展示：`pending` 时弱化视觉（如 `opacity-60`），`created_at` 用本地当前时间（或"刚刚"），成功后被服务端值覆盖。
- [x] 4.4 扩展 `CommentSection.test.tsx` / `CommentItem.test.tsx`：临时项先出现、成功替换、失败移除 + alert；回复同理。

## 5. 回滚提示样式与无障碍（D3）

- [x] 5.1 瞬时 `Alert` 置于操作区上方/评论区顶部，`variant="destructive"`，带手动关闭按钮，约 4s 自动消失。
- [x] 5.2 `Alert` 容器加 `aria-live="polite"`，确保屏幕阅读器播报回滚文案。
- [x] 5.3 不引入 toast / sonner；复用既有 `components/ui/alert`。

## 6. 收尾

- [x] 6.1 `npm run type-check` 通过；`npm run test` 全绿（含新增乐观路径）；`npm run build` 通过。
- [x] 6.2 回归 `PostDetail.test.tsx`：正文四态与现有组合不被破坏。
- [x] 6.3 人工自查：连点投票/收藏不卡死、评论发布无 spinner 空窗、失败有提示且可恢复。
- [x] 6.4 人类签字后，按规约归档本 change（移至 `openspec/changes/archive/`，同步 submodule 指针）。
