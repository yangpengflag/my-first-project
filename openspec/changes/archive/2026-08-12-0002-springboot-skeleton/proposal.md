# Proposal: SpringBoot + Vue 前后端骨架

## Why

项目需要一个可运行的前后端开发框架。后端用 Java 17 + Spring Boot 3.5.16 + Maven，前端用 Vue 3 + Vite + TypeScript。
采用 submodule 模式让前后端各自独立 git 仓库，父仓只管 OpenSpec 产物与 submodule 指针，与 AGENTS.md 硬规则 #2 对齐。

## What Changes

- 安装 Java 17（当前机器为 Java 8，不满足 Spring Boot 3.x 要求）
- 安装 Apache Maven（当前未安装）
- 通过 start.spring.io 或手工创建 Spring Boot 3.5.16 + Maven 项目作为 `backend/` 子仓
- 通过 `npm create vue@latest` 生成 Vue 3 + Vite + TypeScript 项目作为 `frontend/` 子仓
- 在父仓中 `git submodule add` 注册两个子仓
- 回填 `openspec/project.md` 的技术栈与范围信息

## Out of Scope

- 编写任何业务逻辑代码
- 配置 CI/CD、Docker、数据库
- 配置 lint / formatter（留给后续 change）
- 实现前后端联调（API 代理、CORS 等）

## Open Questions

- [x] Java 17 安装方式：winget 安装到 `D:\Programs\java17`
- [x] Maven 安装方式：手动下载到 `D:\Programs\maven`（winget 无此包）
- [x] backend 子仓的 groupId / artifactId：`com.icool:backend`
- [x] frontend 子仓的项目名称：`frontend`
