## ADDED Requirements

### Requirement: 后端骨架

项目 SHALL 提供基于 Java 17 + Spring Boot 3.3.x + Maven 的后端骨架，通过 submodule 独立管理。

#### Scenario: 开发者启动后端
- **WHEN** 开发者进入 `backend/` 目录
- **THEN** 可执行 `mvn compile` 编译通过
- **AND** 可执行 `mvn spring-boot:run` 启动服务

#### Scenario: 后端测试
- **WHEN** 开发者执行 `mvn test`
- **THEN** 所有默认测试通过

### Requirement: 前端骨架

项目 SHALL 提供基于 Vue 3 + Vite + TypeScript 的前端骨架，通过 submodule 独立管理。

#### Scenario: 开发者启动前端
- **WHEN** 开发者进入 `frontend/` 目录
- **THEN** 可执行 `npm install` 安装依赖
- **AND** 可执行 `npm run dev` 启动开发服务器

#### Scenario: 前端构建
- **WHEN** 开发者执行 `npm run build`
- **THEN** 构建产物输出到 `dist/` 目录

### Requirement: Submodule 管理

父仓 SHALL 通过 git submodule 管理 `backend/` 和 `frontend/` 两个子仓。

#### Scenario: 克隆后初始化
- **WHEN** 用户克隆父仓
- **THEN** 执行 `git submodule update --init --recursive` 可拉取子仓代码

#### Scenario: 子仓独立提交
- **WHEN** 在 `backend/` 或 `frontend/` 内修改代码
- **THEN** `git add/commit/push` 在子仓目录内执行
- **AND** 父仓只记录 submodule 指针变更
