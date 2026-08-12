## 1. 环境准备
- [x] 1.1 安装 Java 17（winget 安装到 `D:\Programs\java17`）
- [x] 1.2 安装 Apache Maven 3.9.16（手动下载到 `D:\Programs\maven`）
- [x] 1.3 验证 `java -version` 输出 17+、`mvn -version` 正常

## 2. 后端骨架（backend/）
- [x] 2.1 手工创建 Spring Boot 3.5.16 + Maven 项目（start.spring.io 不提供 3.5.x，手工搭建）
- [x] 2.2 验证 `mvn compile` 通过
- [x] 2.3 在生成目录内 `git init` 并首次提交
- [x] 2.4 父仓 `git submodule add` 添加 backend/

## 3. 前端骨架（frontend/）
- [x] 3.1 运行 `npm create vue@latest` 生成 Vue 3 + TypeScript 项目
- [x] 3.2 验证 `npm install && npm run build` 通过
- [x] 3.3 在生成目录内 `git init` 并首次提交
- [x] 3.4 父仓 `git submodule add` 添加 frontend/

## 4. 父仓更新
- [x] 4.1 回填 `openspec/project.md`（项目名称、愿景、范围、技术栈）
- [x] 4.2 更新 `README.md`（添加 backend/frontend 说明）
- [x] 4.3 更新 `AGENTS.md`（确认 submodule 路径与实际一致）

## 5. 验证
- [x] 5.1 `cd backend && mvn compile` 通过
- [x] 5.2 `cd frontend && npm run build` 通过
- [x] 5.3 父仓 `git submodule status` 显示两个子仓
- [x] 5.4 目录结构与 `design.md` 架构图一致

## 后续（不在本变更范围）
- [ ] 配置前后端联调（API 代理 / CORS）
- [ ] 添加 lint / formatter 配置
- [ ] 配置 CI/CD pipeline
- [ ] 归档本变更 `0002-springboot-skeleton`
