# 技术设计：Todo 待办清单模块

## 架构概览

```
┌─────────────────────────────────────────────────────────
│  前端 (Vue 3 + TypeScript)                               │
│  ┌──────────────  ┌──────────────┐  ┌──────────────┐  │
│  │  TodoView    │→ │  TodoForm    │  │  TodoItem    │  │
│  │  (主页面)     │  │  (创建/编辑)  │  │  (列表项)     │  │
│  ──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │ axios                                          │
│         ↓                                                │
│  ┌──────────────┐                                        │
│  │  api/todo.ts │  (API 封装层)                          │
│  └──────┬───────┘                                        │
└─────────┼────────────────────────────────────────────────┘
          │ HTTP (Vite proxy → localhost:8080)
┌─────────┼────────────────────────────────────────────────┐
│  后端 (Spring Boot 3.5.16)                                │
│         ↓                                                │
│  ┌──────────────┐  ┌──────────────┐  ──────────────┐  │
│  │TodoController│→ │  TodoService │→ │  TodoStore   │  │
│  │  (REST API)  │  │  (业务逻辑)   │  │(ConcurrentHashMap)│
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐                                        │
│  │GlobalException│                                       │
│  │  Handler     │  (异常处理)                            │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案 |
|--------|------|------|----------|
| 存储 | ConcurrentHashMap | 零配置、最简方案、MVP 阶段足够 | H2 / MySQL / PostgreSQL |
| ORM | 无 | 不需要，直接操作内存对象 | Spring Data JPA / MyBatis |
| HTTP 客户端 | axios | Vue 生态标准、TypeScript 支持好 | fetch API |
| 状态管理 | 组件内状态 | Todo 模块简单，无需全局状态 | Pinia / Vuex |
| 异常处理 | `@ControllerAdvice` | Spring 标准方式、统一错误格式 | 各 Controller 单独处理 |

## API 设计

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/todos` | 创建 Todo | `{title, tags?, dueDate?, priority?}` | `201 Todo` |
| GET | `/api/todos` | 查询列表（全部，升序） | - | `200 Todo[]` |
| PUT | `/api/todos/{id}` | 更新 Todo | `{title?, completed?, tags?, dueDate?, priority?}` | `200 Todo` |
| DELETE | `/api/todos/{id}` | 删除 Todo | - | `200` |

## 数据结构

### `Todo` 领域对象（后端 / 前端表示一致）

| 字段 | 类型 | 来源 | 约束 |
|------|------|------|------|
| `id` | `string` (UUID v4) | 后端生成 | 不可由客户端指定；不可变 |
| `title` | `string` | 客户端 | trim 后长度 ∈ [10, 200] 字符；UTF-16 code point 计 |
| `completed` | `boolean` | 客户端 / 后端 | 创建时默认 `false` |
| `tags` | `string[]` | 客户端 | 可选，默认 `[]`；最多 10 个；单个 trim 后 ∈ [1, 20]；后端保存去重 |
| `dueDate` | `string \| null` | 客户端 | 可选，默认 `null`；格式 `YYYY-MM-DD`（ISO-8601 日期，不带时间 / 时区） |
| `priority` | `"LOW" \| "MEDIUM" \| "HIGH"` | 客户端 | 可选，默认 `"MEDIUM"`；严格枚举 |
| `createdAt` | `string` (ISO-8601) | 后端生成 | 创建时设置后不可变 |
| `updatedAt` | `string` (ISO-8601) | 后端生成 | 每次修改后刷新；创建时 = `createdAt` |

## 存储层设计

```java
@Component
public class TodoStore {
    private final ConcurrentHashMap<String, Todo> store = new ConcurrentHashMap<>();
    
    // CRUD 方法...
}
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 进程重启数据丢失 | MVP 阶段可接受 | README 中明确说明，后续可替换为数据库 |
| CORS 跨域问题 | 前后端联调失败 | Vite devServer proxy 解决 |
| 字段命名不一致 | 前后端对接出错 | 统一驼峰法 + Jackson 配置 |
| 并发安全 | ConcurrentHashMap 保证线程安全 | 无需额外处理 |
