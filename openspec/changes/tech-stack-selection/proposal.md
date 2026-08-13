## Why

团队（3 人，全员 React 背景、Vue 仅 2.x 经验）需在 8 周内交付 MVP，部署目标为 Vercel 或自建设 Docker，且以 AI 辅助开发为主要生产力来源。当前 `openspec/project.md` 锁定的技术栈为 "Java 17 + Spring Boot 3 + Vue 3"，与团队能力与 AI 生成质量最优路径不匹配：Vue 2.x 经验对 Nuxt 3 (Vue 3) 几乎零迁移价值，且 Java/Spring 对前端团队学习曲线陡峭、Docker 镜像重。需重新选型并以 spec 形式固化，作为后续所有 change 的约束来源。

## What Changes

- 前端框架由 Vue 3 变更为 **Next.js 14 (App Router) + React 19 + TypeScript**。
- 后端框架由 Spring Boot 3 变更为 **NestJS (TypeScript) + TypeORM**，MVP 期使用 SQLite，上线切 PostgreSQL。
- 全栈统一为 TypeScript，新增 `packages/types` 共享 DTO，前后端类型零漂移。
- 部署：前端优先 Vercel 零配置；后端 NestJS 打 `node:20-alpine` 轻量 Docker 镜像兜底自建设部署。
- 更新 `openspec/project.md` 愿景与约束章节，使其与选定栈一致。
- **BREAKING**: 移除对 `springboot-skeleton` spec 的依赖；现有 `backend/`(Spring) 与 `frontend/`(Vue) submodule 不再作为 MVP 技术栈，按新栈重建脚手架。

## Capabilities

### New Capabilities
- `tech-stack`: 定义本项目 MVP 阶段强制技术栈约束（前端 Next.js 14、后端 NestJS、全栈 TypeScript、部署目标 Vercel/Docker），作为后续所有 change 的选型依据与校验基准。

### Modified Capabilities
- `springboot-skeleton`: 该能力被 `tech-stack` 取代，需求层不再要求 Spring Boot 脚手架；标记为废弃（见 Impact）。

## Impact

- **约束文档**: `openspec/project.md` 愿景、范围、约束章节需改写（Spring Boot 3.5.16 + Vue 3 → Next.js 14 + NestJS）。
- **Specs**: 现有 `openspec/specs/springboot-skeleton.md` 不再作为真相来源，由 `tech-stack` 能力替代。
- **Submodule 结构**: `backend/` 与 `frontend/` 子仓需按新栈重建（后端 NestJS、前端 Next 14）；本次 change 仅确定选型与约束，不实现业务代码（业务实现走后续独立 change）。
- **依赖**: 新增 Node 20.19+ 运行时要求；Vercel 部署需 `@vercel/next` 适配（Next 原生支持）；后端 Docker 基础镜像 `node:20-alpine`。
- **团队**: 无需学习 Java/Vue 3；全程 TypeScript，与现有 React 经验无缝衔接。
