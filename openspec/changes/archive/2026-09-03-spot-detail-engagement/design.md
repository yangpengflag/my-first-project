# Design (spot-detail-engagement)

## 总览架构

```
SPOT DETAIL ── spots/[slug]/SpotDetail (server component)
  ├─ <SpotGallery coverImage gallery />          (新, "use client")
  ├─ 两列基础信息 (已实现, 不改)
  ├─ <BookmarkButton targetType="spot" targetId={slug} />   (泛化)
  ├─ 位置 / 周边 / 相关攻略 (已实现)
  └─ <SpotCommentSection slug={slug} />           (新, components/places)

后端
  SpotComment { id, spotSlug, userId, content, parentCommentId, deleted }   (独立表 spot_comments)
  SpotCommentsController
    POST   /api/spots/{slug}/comments
    GET    /api/spots/{slug}/comments
    GET    /api/spot-comments/{id}/replies      ← 端点与帖子评论分离 (注记 B)
    DELETE /api/spot-comments/{id}
```

## 后端：SpotComment（镜像 Comment / SpotBookmark）

**实体**：`SpotComment extends BaseEntity`，字段 `spotSlug(String)` / `userId(UUID)` / `content(TEXT)` / `parentCommentId(UUID)`。
`spotSlug` 非空；软删沿用 `BaseEntity` 内核（`findByIdAndDeletedFalse` 显式过滤，不在类上加 `@SQLRestriction`）。

**仓储** `SpotCommentRepository` 方法（照搬 `CommentRepository` 但 `postId`→`spotSlug`）：
- `findBySpotSlugAndParentCommentIdIsNullAndDeletedFalse(slug, pageable)`
- `findByParentCommentIdAndDeletedFalse(parentId, pageable)`
- `findByIdAndDeletedFalse(id)`
- `countByParentCommentIdAndDeletedFalse(parentId)`
- `findBySpotSlugAndIdAndDeletedFalse(slug, id)`（校验回复父评论同景点且顶层）
- `findAllByParentCommentIdAndDeletedFalse(parentId)`（级联软删）

**服务** `SpotCommentService`（校验 `spotRepository.findBySlugAndDeletedFalse` → `SPOT_NOT_FOUND`；父评论须同景点且顶层 → `INVALID_PARENT_COMMENT`；删除仅作者 → `NOT_COMMENT_AUTHOR`，顶层级联软删回复）：`create` / `listTopLevel` / `listReplies` / `delete`，作者信息经 `UserRepository.findAllById` 批量解析、缺失/注销回退占位（照搬 `CommentService.resolveAuthors`）。

**响应 DTO**：新建 `SpotCommentResponse`，字段与 `CommentResponse` 同构，但 `post_id` 换成 **`spot_slug`(String)**——与 `SpotBookmarkStatusResponse`(spot_slug) vs `BookmarkStatusResponse`(post_id) 的「分两类」先例一致（见注记 A）。列表/回复端点复用同一类。

**异常**：复用 `ErrorCode.SPOT_NOT_FOUND` / `INVALID_PARENT_COMMENT` / `NOT_COMMENT_AUTHOR` / `COMMENT_NOT_FOUND`（后者沿用评论体系命名，或新增 `SPOT_COMMENT_NOT_FOUND` 与 `SPOT_NOT_FOUND` 区分——实现时择一，保持与 `CommentException` 一致即可）。

## 前端：收藏泛化

抽 `useBookmark(targetType: "post" | "spot", targetId: string)` hook：
- 内部按 `targetType` 选择 `bookmarksApi`(postId: UUID) 或 `spotBookmarksApi`(slug: String)，调用 `status/toggle`，读取 `res.bookmarked`。
- `BookmarkButton` 退化为薄展示层：仅吃 `{ bookmarked, pending, onToggle, redirectPath? }` 渲染图标+文案。
- 登录未鉴权点击 → 跳 `/login?redirect={redirectPath}`（`/posts/{id}` 或 `/spots/{slug}`）。
- 新增 `lib/spot-bookmarks/api.ts`：`status(slug)` / `toggle(slug)` 打 `GET|POST /api/spots/{slug}/bookmark`，类型 `SpotBookmarkStatusResponse`（`spot_slug` + `bookmarked`）。

## 前端：评论泛化

抽 `CommentThreadApi` 接口（注入式，屏蔽 post/spot 端点差异）：
```ts
interface CommentThreadApi {
  list(page: number, size: number): Promise<PageCommentResponse>;
  create(content: string, parentCommentId?: string): Promise<CommentResponse>;
  replies(commentId: string, page: number, size: number): Promise<PageCommentResponse>;
  remove(commentId: string): Promise<void>;
}
```
- `CommentItem` 改为接收注入的 `api`（仅需 `replies`/`create`/`remove`）+ `currentUserId`/`currentUserName`，**不再直接 import `commentsApi`**（注记 C 回归风险）。
- `CommentSection`(post) 用 `makePostCommentApi(postId)` 包裹现有 `commentsApi`；新建 `SpotCommentSection`(`components/places/`) 用 `makeSpotCommentApi(slug)` 包裹 `spotCommentsApi`。两者共用 `CommentItem` 展示层与乐观流（`useOptimisticAction` 通用，无需改）。
- **类型**：抽公共展示类型 `CommentThreadItem` = `CommentItem` 实际用到的字段（`id`/`content`/`author_name`/`author_avatar_url?`/`created_at`/`updated_at?`/`reply_count`/`user_id`/`parent_comment_id`/`pending?`）。`post_id` 是摆设（回复靠 `comment.id` 路由，从不被读取）→ 从公共类型移除。`CommentView`(生成) 与 `SpotCommentView`(手写) 均满足 `CommentThreadItem`。
- `lib/spot-comments/`：`api.ts`(`spotCommentsApi`：4 端点)、`types.ts`(`SpotCommentView` 手写，符合 `lib/places` 模块「手写契约」约定)、`messages.ts`(错误文案映射复用 `describeCommentError` 思路)。

## 前端：SpotGallery（原生，无库）

- 输入 `images: string[]`（由 `SpotDetail` 计算：`gallery.length ? gallery : coverImage ? [coverImage] : []`）。
- `index` state；`images.length <= 1` 时隐藏 prev/next/圆点，仅静态展示。
- 主图用 `<img>`（`alt={spot.nameEn}`，`object-cover`，`aspect-[16/9]`，`bg-slate-100` 兜底）；缩略图条为 `<button>` 切换 + `focus-visible` ring。
- 键盘：`region` 聚焦时 `ArrowLeft/Right` 切换；`role="group"` + `aria-roledescription="slide"`；prev/next 按钮带 `aria-label`。
- 切换直接换 `src`，**不加 fade/slide/parallax**（样式规约）。
- `images.length === 0` → 渐变占位 `bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100` + `ImageIcon`。

## 数据 / 契约映射（已验证通路）

- 轮播：`Spot.galleryUrls`(后端) → `SpotDetail.gallery_urls` → `client.ts mapSpot.gallery`（第97行，已通；种子已灌 `gallery`）。
- 景点评论：后端 `SpotCommentResponse.spot_slug` → 前端 `SpotCommentView` **手写**映射（places 模块约定，不强行 `openapi:gen`）。

## 设计注记（探索期锁定，A–J）

- **A** 评论响应 `post_id`→`spot_slug` 分两类（镜像收藏先例）；`post_id` 在展示层为摆设，从公共类型移除。
- **B** 回复端点必须按 target 分开：`GET /api/spot-comments/{id}/replies`，否则景点评论 404。
- **C** 泛化 `CommentItem` 是改在跑的帖子评论代码；`CommentSection.test.tsx` 大概率 mock `commentsApi` 模块，重构后需改 mock 处——任务须显式保持帖子评论测试全绿。
- **D** 登录回跳路径按 target：`/posts/{id}` vs `/spots/{slug}`。
- **E** 轮播空/单图降级 + `<img alt>` 选型（避免 `next/image` 远程域名配置）。
- **F** 命名/目录：`spot-detail-engagement` 独立 change；新模块见 proposal。
- **G** 景点评论类型手写（与 `lib/places` 一致），不强迫 openapi 生成。
- **H** TDD 范围见 tasks.md（后端 4 测试类 + 前端 4+ 测试类 + page 测试扩展）。
- **I** 服务端/客户端边界无碍：`SpotDetail` 为 server component，渲染 client 子组件；`page.tsx` 已 `force-dynamic`。
- **J** 景点详情页收藏只需 toggle/status（`/api/spot-bookmarks` 列表已存在），无额外后端。

## 风险

- **C 回归**：`CommentItem` 去 `commentsApi` 直引后，`CommentSection.test.tsx` 的 mock 策略须在重构时一并修正，保证帖子评论测试不红。实现第一步先读该测试。
- **B 遗漏**：若实现时误复用帖子评论的 `/api/comments/{id}/replies` 端点，景点回复会 404——`SpotCommentThreadApi.replies` 必须打 `/api/spot-comments/{id}/replies`。
