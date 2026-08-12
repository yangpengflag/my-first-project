# Project Spec

## 项目名称

> my-first-project

## 愿景

> 基于 Java Spring Boot + Vue 3 的全栈 Web 应用开发框架，采用 submodule 模式管理前后端代码。

## 范围（in scope）

- 后端：Java 17 + Spring Boot 3.5.16 + Maven 骨架
- 前端：Vue 3 + Vite + TypeScript 骨架
- 仓库结构：父仓管理 OpenSpec 产物，backend/ 和 frontend/ 作为 git submodule
- AI agent 驱动的结构化开发工作流（OpenSpec + Superpowers）

## 非目标（out of scope）

- 业务逻辑代码（骨架只包含脚手架默认文件）
- CI/CD、Docker 配置
- 数据库集成
- 前后端联调（API 代理 / CORS）

## 关键术语

| 术语 | 定义 |
|------|------|
| 父仓 | my-first-project 根仓库，管理 OpenSpec 产物 |
| 子仓 | backend/ 和 frontend/，各自独立的 git 仓库 |
| OpenSpec | 规格驱动开发流程层 |
| Harness | IDE 原生配置层（.qoder/） |
| Superpowers | 开发方法论层（skills/） |

## 约束

- 后端：Java 17 + Spring Boot 3.5.16 + Maven
- 前端：Vue 3 + Vite + TypeScript
- IDE：Qoder（.qoder/ 配置目录）
- 工作流：OpenSpec spec-driven，TDD 强制

## 成功标准

- `cd backend && mvn test` 通过
- `cd frontend && npm run build` 通过
- 父仓 `git submodule status` 显示两个子仓正常
- AI agent 可通过 `/opsx:propose` 开始新变更
