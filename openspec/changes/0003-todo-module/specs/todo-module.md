## ADDED Requirements

### Requirement: 模块边界

Todo 模块 SHALL 提供单用户私有的待办事项管理功能，包含创建、查询、更新、删除、状态切换五项核心操作。

#### In Scope（包含）
- Todo 的增删改查（CRUD）
- 状态切换（待办 ↔ 已完成）
- 按创建时间升序排列（固定，不可配置）
- 字段命名统一使用驼峰法（camelCase）
- 数据字段：`title`、`completed`、`tags`、`dueDate`、`priority`

#### Out of Scope（不包含）
- 多用户 / 协作功能
- 用户注册 / 登录 / 认证
- 数据库持久化（使用 ConcurrentHashMap 内存存储）
- 分页 / 排序 / 搜索 / 过滤
- 软删除 / 审计字段
- 批量操作
- 附件 / 子任务 / 提醒通知
- WebSocket / SSE 实时同步
- 国际化（i18n）

### Requirement: 创建 Todo

系统 SHALL 允许用户创建一条 Todo 记录，必填字段为 `title`。

#### Scenario: 正常创建
- **WHEN** 用户提交 `POST /api/todos`，请求体包含 `title: "买牛奶和面包"`
- **THEN** 系统返回 HTTP 201
- **AND** 响应体包含生成的 `id`（UUID v4 字符串）、`title`、`completed: false`、`createdAt`、`updatedAt`

#### Scenario: title 为空字符串
- **WHEN** 用户提交 `POST /api/todos`，请求体包含 `title: ""`
- **THEN** 系统返回 HTTP 400
- **AND** 响应体包含错误信息 `"title 不能为空"`

#### Scenario: title 缺失
- **WHEN** 用户提交 `POST /api/todos`，请求体不包含 `title` 字段
- **THEN** 系统返回 HTTP 400
- **AND** 响应体包含错误信息 `"title 不能为空"`

#### Scenario: title 长度不足
- **WHEN** 用户提交 `POST /api/todos`，请求体包含 `title: "买牛奶"`（少于 10 字符）
- **THEN** 系统返回 HTTP 400
- **AND** 响应体包含错误信息 `"title 长度不能少于 10 个字符"`

#### Scenario: title 超过最大长度
- **WHEN** 用户提交 `POST /api/todos`，请求体包含 `title` 长度超过 200 字符
- **THEN** 系统返回 HTTP 400
- **AND** 响应体包含错误信息 `"title 长度不能超过 200 个字符"`

### Requirement: 查询 Todo 列表

系统 SHALL 提供 Todo 列表查询接口，一次性返回全部 Todo，按创建时间升序排列。

#### Scenario: 查询全部 Todo
- **WHEN** 用户请求 `GET /api/todos`
- **THEN** 系统返回 HTTP 200
- **AND** 响应体为 Todo 数组，按 `createdAt` 升序排列

#### Scenario: 无 Todo 时
- **WHEN** 用户请求 `GET /api/todos`，且系统中无任何 Todo
- **THEN** 系统返回 HTTP 200
- **AND** 响应体为空数组 `[]`

### Requirement: 更新 Todo

系统 SHALL 允许用户更新 Todo 的 `title`、`completed`、`tags`、`dueDate`、`priority` 字段。

#### Scenario: 正常更新标题
- **WHEN** 用户提交 `PUT /api/todos/{id}`，请求体包含 `title: "买牛奶和面包"`
- **THEN** 系统返回 HTTP 200
- **AND** 响应体中该 Todo 的 `title` 已更新，`updatedAt` 已刷新

#### Scenario: 正常切换完成状态
- **WHEN** 用户提交 `PUT /api/todos/{id}`，请求体包含 `completed: true`
- **THEN** 系统返回 HTTP 200
- **AND** 响应体中该 Todo 的 `completed` 为 `true`

#### Scenario: 正常更新标签
- **WHEN** 用户提交 `PUT /api/todos/{id}`，请求体包含 `tags: ["工作", "紧急"]`
- **THEN** 系统返回 HTTP 200
- **AND** 响应体中该 Todo 的 `tags` 已更新

#### Scenario: title 长度不足
- **WHEN** 用户提交 `PUT /api/todos/{id}`，请求体包含 `title: "测试"`（少于 10 字符）
- **THEN** 系统返回 HTTP 400
- **AND** 响应体包含错误信息 `"title 长度不能少于 10 个字符"`

#### Scenario: Todo 不存在
- **WHEN** 用户提交 `PUT /api/todos/{id}`，请求体包含 `title: "测试标题内容"`
- **THEN** 系统返回 HTTP 404
- **AND** 响应体包含错误信息 `"Todo 不存在，ID: {id}"`

### Requirement: 删除 Todo

系统 SHALL 允许用户删除指定 Todo，删除即物理删除。

#### Scenario: 正常删除
- **WHEN** 用户请求 `DELETE /api/todos/{id}`
- **THEN** 系统返回 HTTP 200
- **AND** 该 Todo 已从内存存储中移除

#### Scenario: Todo 不存在
- **WHEN** 用户请求 `DELETE /api/todos/{id}`
- **THEN** 系统返回 HTTP 404
- **AND** 响应体包含错误信息 `"Todo 不存在，ID: {id}"`

### Requirement: 数据结构

所有接口 SHALL 使用驼峰命名法（camelCase），请求和响应格式 SHALL 遵循以下定义。

#### Todo 对象

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

#### 创建请求体

| 字段 | 类型 | 约束 |
|------|------|------|
| `title` | `string` | trim 后长度 ∈ [10, 200] 字符 |
| `tags` | `string[]` | 可选，默认 `[]`；最多 10 个；单个 trim 后 ∈ [1, 20] |
| `dueDate` | `string \| null` | 可选，默认 `null`；格式 `YYYY-MM-DD` |
| `priority` | `"LOW" \| "MEDIUM" \| "HIGH"` | 可选，默认 `"MEDIUM"` |

#### 更新请求体

| 字段 | 类型 | 约束 |
|------|------|------|
| `title` | `string` | 可选，trim 后长度 ∈ [10, 200] 字符 |
| `completed` | `boolean` | 可选 |
| `tags` | `string[]` | 可选；最多 10 个；单个 trim 后 ∈ [1, 20] |
| `dueDate` | `string \| null` | 可选；格式 `YYYY-MM-DD` |
| `priority` | `"LOW" \| "MEDIUM" \| "HIGH"` | 可选 |

#### 错误响应体

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | Integer | HTTP 状态码 |
| `message` | String | 错误描述 |

### Requirement: 验收标准

以下标准 SHALL 全部满足后，Todo 模块方可视为完成。

- [ ] 后端 `POST /api/todos` 可创建 Todo，返回 201 + 完整对象
- [ ] 后端 `GET /api/todos` 返回全部 Todo，按 `createdAt` 升序
- [ ] 后端 `PUT /api/todos/{id}` 可更新所有字段
- [ ] 后端 `DELETE /api/todos/{id}` 可删除 Todo
- [ ] 所有异常路径返回正确的 HTTP 状态码和错误信息
- [ ] 前端 Todo 列表页面可展示、创建、编辑、删除 Todo
- [ ] 前端 Todo 状态切换（勾选/取消）功能正常
- [ ] 前后端字段命名统一使用驼峰法
- [ ] 所有单元测试通过
