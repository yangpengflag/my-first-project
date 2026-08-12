# Design: SpringBoot + Vue 前后端骨架

## 决策一览

| 决策 | 选择 | 理由 |
|---|---|---|
| 仓库结构 | Submodule（backend/ + frontend/） | 与 AGENTS.md 硬规则 #2 一致；前后端独立版本管理 |
| Java 版本 | 17（LTS） | Spring Boot 3.x 最低要求；当前机器为 Java 8 需升级 |
| Spring Boot 版本 | 3.5.16 | Maven Central 最新稳定版（2026-06-25） |
| 构建工具 | Maven | 用户明确指定 |
| 前端框架 | Vue 3 + Vite + TypeScript | 用户选择；国内生态成熟 |
| 后端脚手架 | `curl start.spring.io` | 官方工具，依赖版本兼容，可复现 |
| 前端脚手架 | `npm create vue@latest` | Vue 官方工具，最佳实践 |
| 子仓初始化时机 | 先独立 `git init`，再 `submodule add` | submodule 要求目标已是 git 仓库 |

## 架构图

```
my-first-project/                  ← 父仓（OpenSpec 管理）
├── backend/                       ← git submodule
│   ├── pom.xml                    ← Maven 构建配置
│   ├── src/main/java/             ← Java 源码
│   ├── src/main/resources/        ← 配置文件（application.yml）
│   └── src/test/java/             ← 测试代码
├── frontend/                      ← git submodule
│   ├── package.json               ← npm 依赖
│   ├── vite.config.ts             ← Vite 构建配置
│   ├── tsconfig.json              ← TypeScript 配置
│   └── src/                       ← Vue 源码
├── openspec/                      ← 规格驱动层
└── AGENTS.md                      ← AI agent 指令
```

## 备选方案

**方案 B：手工搭建 pom.xml + Vite 配置**——完全可控，理解每一行。
拒绝：容易遗漏配置，版本兼容性需手动验证，不如官方脚手架可靠。

**方案 C：单仓多目录，不用 submodule**——简单直接。
拒绝：AGENTS.md 硬规则 #2 已明确要求 submodule 模式。

## 风险

- **Java 升级风险**：当前 Java 8 → 17，可能影响本机其他项目。**缓解**：用 SDKMAN 或手动安装，不覆盖原 Java 8，通过 JAVA_HOME 切换。
- **网络依赖**：start.spring.io 和 npm registry 需要网络。**缓解**：确认网络可用后执行；如有代理需配置。
- **Submodule 管理复杂度**：git 操作需在子仓内执行。**缓解**：AGENTS.md 硬规则已明确操作规范。

## 不引入

- 任何业务代码——骨架只包含脚手架生成的默认文件。
- CI/CD 配置——等骨架跑通后再加。
- 数据库驱动——等具体业务需求确定后再引入。
