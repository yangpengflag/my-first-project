# Tasks — spot-detail-engagement

> TDD 顺序：每项下先 RED（失败测试）→ GREEN（实现）→ 如需 REFACTOR。后端优先于其前端消费方。

## 后端：SpotComment 子系统

- [x] B1 `SpotComment` 实体 + `SpotCommentRepository`（含 `findBySpotSlugAndParentCommentIdIsNullAndDeletedFalse` / `findByParentCommentIdAndDeletedFalse` / `findByIdAndDeletedFalse` / `countByParentCommentIdAndDeletedFalse` / `findBySpotSlugAndIdAndDeletedFalse` / `findAllByParentCommentIdAndDeletedFalse`）
  - RED: `SpotCommentTest`（工厂 + 软删）、`SpotCommentRepositoryTest`（各查询 + reply_count + 同景点父校验）
- [x] B2 `SpotCommentService`（`create` 校验景点存在/`INVALID_PARENT_COMMENT`；`listTopLevel` 倒序分页含 reply_count；`listReplies` 升序；`delete` 仅作者 + 顶层级联软删回复 + 作者批量解析回退）
  - RED: `SpotCommentServiceTest`（四个方法 + `SPOT_NOT_FOUND`/`NOT_COMMENT_AUTHOR`/`INVALID_PARENT_COMMENT`/`COMMENT_NOT_FOUND`）
- [x] B3 `SpotCommentsController`（4 端点 + 鉴权闸门 + 404 语义）
  - RED: `SpotCommentsControllerIntegrationTest`（含 `POST/GET /api/spots/{slug}/comments`、`GET /api/spot-comments/{id}/replies`、`DELETE /api/spot-comments/{id}`、未鉴权 401、景点不存在 404）
- [x] B4 `SpotCommentResponse`（`spot_slug` 替代 `post_id`，白名单同 `CommentResponse`）+ 序列化测试

## 前端：SpotGallery

- [x] F1 `components/places/SpotGallery.tsx`（主图 + 缩略图 + 键盘 `←/→` + 圆点 + 空/单图降级 + 渐变占位 + `<img alt>`）
  - RED: `SpotGallery.test.tsx`（轮播切换、键盘导航、单图隐藏控件、空图占位）

## 前端：收藏泛化

- [x] F2 抽 `useBookmark(targetType, targetId)` hook + 改造 `BookmarkButton` 为薄展示层 + 新增 `lib/spot-bookmarks/api.ts`（`status`/`toggle` 打 `/api/spots/{slug}/bookmark`）
  - RED: 扩展 `BookmarkButton.test.tsx`（覆盖 `targetType="spot"` 路径 + 回跳 `/spots/{slug}`）

## 前端：评论泛化

- [x] F3 抽 `CommentThreadApi` 接口 + `CommentItem` 改为注入 api（去 `commentsApi` 直引）+ `CommentSection`(post) 用 `makePostCommentApi` 包裹
  - RED→GREEN: 修正 `CommentSection.test.tsx` mock 策略，**保持帖子评论测试全绿**
- [x] F4 `lib/spot-comments/{api,types,messages}.ts`（`spotCommentsApi` 4 端点；`SpotCommentView` 手写满足 `CommentThreadItem`）
- [x] F5 `components/places/SpotCommentSection.tsx`（用 `makeSpotCommentApi(slug)` 复用 `CommentItem` + 乐观流）
  - RED: `SpotCommentSection.test.tsx`（列表/空/登录门/乐观发布/回复/删除回滚）

## 前端：详情页集成

- [x] F6 `SpotDetail` 接入 `<SpotGallery>`（替换第73–76行单图 `<div>`）+ `<BookmarkButton targetType="spot">` + `<SpotCommentSection slug={slug}>`
  - RED→GREEN: 扩展 `spots/[slug]/page.test.tsx`（断言画廊/收藏/评论区渲染，四态覆盖）

## 验收

- [x] X1 类型检查 `npm run type-check` 全绿
- [x] X2 前端测试 `npm test` 全绿（含既有 `CommentSection`/`BookmarkButton` 帖子路径不被破坏）
- [x] X3 后端 `mvn -o test`（SpotComment 四个测试类全绿）
- [x] X4 构建 `npm run build` 通过；`openapi.json` 不含 spot 评论端点（places 手写约定，drift 跳过 gen，仅确保手写在手）
