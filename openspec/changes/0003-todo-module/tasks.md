# 施工排期：Todo 待办清单模块

## 后端任务

### 1. 创建 Todo 数据类
- **文件**: `backend/src/main/java/com/icool/backend/model/Todo.java`
- **操作**: 创建 POJO，字段 id/title/completed/tags/dueDate/priority/createdAt/updatedAt
- **验证**: 编译通过

### 2. 创建 TodoStore 内存存储层
- **文件**: `backend/src/main/java/com/icool/backend/store/TodoStore.java`
- **操作**: 使用 ConcurrentHashMap 实现 CRUD，AtomicLong 生成 ID
- **验证**: 编译通过

### 3. 创建 TodoService
- **文件**: `backend/src/main/java/com/icool/backend/service/TodoService.java`
- **操作**: 实现业务逻辑，包含参数校验（title 非空、长度限制）
- **验证**: 编译通过

### 4. 创建 TodoController
- **文件**: `backend/src/main/java/com/icool/backend/controller/TodoController.java`
- **操作**: 实现 REST API 端点（POST/GET/PUT/DELETE）
- **验证**: `mvn compile` 通过

### 5. 创建全局异常处理器
- **文件**: `backend/src/main/java/com/icool/backend/exception/GlobalExceptionHandler.java`
- **操作**: 统一处理参数校验异常和资源不存在异常
- **验证**: 编译通过

### 6. 编写单元测试
- **文件**: `backend/src/test/java/com/icool/backend/service/TodoServiceTest.java`
- **操作**: 覆盖正常路径和异常路径
- **验证**: `mvn test` 全部通过

## 前端任务

### 7. 安装 axios
- **文件**: `frontend/package.json`
- **操作**: `npm install axios`
- **验证**: `node_modules/axios` 存在

### 8. 创建 API 封装层
- **文件**: `frontend/src/api/todo.ts`
- **操作**: 封装 todos CRUD 请求
- **验证**: TypeScript 编译无报错

### 9. 配置 Vite 代理
- **文件**: `frontend/vite.config.ts`
- **操作**: 添加 `/api` 代理到 `localhost:8080`
- **验证**: 前端可请求后端 API

### 10. 创建 TodoItem 组件
- **文件**: `frontend/src/components/TodoItem.vue`
- **操作**: 展示单条 Todo，支持状态切换和删除
- **验证**: 组件渲染正常

### 11. 创建 TodoForm 组件
- **文件**: `frontend/src/components/TodoForm.vue`
- **操作**: 创建/编辑 Todo 的表单（含 tags、dueDate、priority）
- **验证**: 表单提交正常

### 12. 创建 TodoView 页面
- **文件**: `frontend/src/views/TodoView.vue`
- **操作**: 整合列表、表单
- **验证**: 页面功能完整

### 13. 配置路由
- **文件**: `frontend/src/router/index.ts`
- **操作**: 添加 `/todos` 路由
- **验证**: 路由跳转正常

## 后续

- [ ] 归档变更 `0003-todo-module`
- [ ] 合并增量规格到 `openspec/specs/`
- [ ] 更新 `openspec/project.md`
