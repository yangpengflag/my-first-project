# Tasks — admin-comment-delete

> 本 change 先于 OpenSpec 产物在对话中实现（补档）。下表为已落地工作的对账清单，TDD 顺序已在代码层验证。

## 后端

- [x] B1 `Role` 枚举（`auth/domain/Role.java`，USER/ADMIN）+ `User.role` 字段（`@Enumerated(STRING)`、`nullable=false`、`length=16`、默认 `Role.USER`）+ `register` 固定 `USER` + `getRole()/setRole()`
  - RED/GREEN：`UserTest` 覆盖默认 `Role.USER` 与构造默认值
- [x] B2 `UserResponse` 加 `role` 白名单字段 + `from()` 映射 + `WHITELISTED_FIELDS` 含 `"role"`
  - RED/GREEN：`UserResponseSerializationTest` 键集合严格相等（含 `role`）
- [x] B3 `CommentService.delete` 增 admin 豁免（`userRepository.findById → Role.ADMIN`）
  - RED/GREEN：`CommentServiceTest.deleteByAdminSucceedsEvenIfNotAuthor` + 既有作者/非作者用例
- [x] B4 `SpotCommentService.delete` 增 admin 豁免（镜像）
  - RED/GREEN：`SpotCommentServiceTest.deleteByAdminSucceedsEvenIfNotAuthor` + 既有用例

## 契约

- [x] C1 `openapi.json` `UserResponse` 加 `role` enum（`"USER" | "ADMIN"`）；`npm run openapi:gen` 重生成 `lib/api.generated.ts`（`UserResponse.role` 为内联 union 类型 `"USER" | "ADMIN"`——openapi-typescript 默认行为，与命名 `UserRole` 功能等价）
  - 验证：`npm run type-check` 通过

## 前端

- [x] F1 `CommentThread` 传 `currentUserRole={user?.role}` 给 `CommentItem`
- [x] F2 `CommentItem` 加 `currentUserRole` prop；`canDelete` 与回复 `replyCanDelete` 支持 `=== "ADMIN"`
  - RED/GREEN：既有评论组件测试（乐观删除 / 回复删除）保持通过；`tsc` 通过

## 验收

- [x] X1 后端 `mvn -o test -Dtest=CommentServiceTest,SpotCommentServiceTest,UserResponseSerializationTest,UserTest`：58 全绿
- [x] X2 前端 `npm run type-check` 全绿
- [x] X3 前端 lint 相关文件 0 error
- [x] X4 存量用户 `role` 为 NULL → 安全降级为非 admin（`getRole() == null` 判定），设计 R1 回填步骤记录在案
