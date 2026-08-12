# Proposal: Todo 待办清单模块

## What Changes

### 模块边界（不包含 / Out of Scope）

- ❌ **多用户与协作**：本模块仅支持单用户私有，无 user 概念，无 owner 字段，无并发冲突处理
- ❌ **认证 / 授权**：不引入 Spring Security，不做登录态
- ❌ **持久化到数据库**：仅内存存储（`ConcurrentHashMap`），进程重启数据丢失（已知约定，写入 README 提醒）
- ❌ **分页 / 排序 / 搜索 / 过滤**：`GET /api/todos` 一次性返回全部，按创建时间升序固定
- ❌ **软删除 / 审计字段**：删除即物理删除，无 `deletedAt` / `deletedBy`
- ❌ **批量操作**：无 batch create / batch delete
- ❌ **附件 / 子任务 / 提醒通知**：本模块业务字段限定为 `title` / `completed` / `tags` / `dueDate` / `priority` 五项
- ❌ **WebSocket / SSE 实时同步**：纯 HTTP 请求-响应
- ❌ **国际化**：UI 文案与错误消息仅中文 / 英文混排，不做 i18n

### 后端变更

- 创建 `Todo` 数据类（5 个字段：title、completed、tags、dueDate、priority）
- 创建 `TodoStore` 内存存储层（`ConcurrentHashMap`）
- 创建 `TodoService` 业务逻辑层
- 创建 `TodoController` REST 控制器（`/api/todos`）
- 创建全局异常处理器 `GlobalExceptionHandler`

### 前端变更

- 安装 `axios` HTTP 客户端
- 创建 `api/todo.ts` API 封装层
- 创建 `views/TodoView.vue` 主页面
- 创建 `components/TodoItem.vue` 列表项组件
- 创建 `components/TodoForm.vue` 表单组件
- 配置 Vite 开发代理（`/api` → `localhost:8080`）

### 规格变更

- 新增 `openspec/specs/todo-module.md`

## Open Questions

- [x] 存储方案：ConcurrentHashMap 内存存储（MVP 阶段，后续可替换为数据库）
- [x] 字段命名：统一使用驼峰法（camelCase）
- [x] 单用户私有：不做多用户和协作功能
- [x] 数据字段：title、completed、tags、dueDate、priority 五项
