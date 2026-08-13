# 技术设计：仓库知识库 (Repo Wiki)

## 架构概览

```
用户 / AI (skill: repo-wiki)
        │  调用
        ↓
scripts/wiki-generator.ts  (Node + tsx)
        │  1. 扫描 backend/ + frontend/
        │  2. 解析目录/文件结构、关键符号
        │  3. 写入 docs/wiki/
        ↓
docs/wiki/
  ├── INDEX.md            (总览 + 链接 + 时间戳)
  ├── architecture.md     (分层架构)
  └── modules/<module>.md (模块说明)
```

检索路径：AI 问答时先读 `docs/wiki/INDEX.md`，按链接定位到具体模块文档，再做定向读取。

## 技术决策

| 决策项 | 选择 | 理由 | 替代方案 |
|--------|------|------|----------|
| 运行方式 | `tsx scripts/wiki-generator.ts` | 复用 Node 生态，无需编译步骤 | 编译为 JS / Python |
| 文档格式 | Markdown | 人类可读 + AI 可直接读 + Git 可 diff | JSON / HTML |
| 检索 | INDEX + 文件路径 | 零依赖、可复现、可 git 追踪 | 向量库 RAG |
| 内容来源 | 脚本提取结构 + AI 补叙述 | 离线可跑、成本低；AI 在 skill 中润色 | LLM 全程生成 |
| 增量更新 | 基于文件 mtime 比对 | 避免每次全量重建 | 全量重建 / git diff |

## 扫描策略

### backend/（Spring Boot, Java）

- 入口：`backend/src/main/java/com/`
- 按 Java 包目录识别模块（如 `controller/`、`service/`、`store/`、`exception/`、`model/`）。
- 提取：每个 `.java` 文件的 `public class/interface`、主要 `@RestController`/`@Service`/`@Component` 注解、公开方法签名。
- 模块划分：以顶层业务包（如 `com.icool.backend`）下的功能子包为粒度。

### frontend/（Vue 3 + TS）

- 入口：`frontend/src/`
- 按 `views/`、`components/`、`stores/`、`router/`、`api/`（如有）划分模块。
- 提取：`.vue` 组件的 `<script setup>` 导出、`defineProps`/`defineEmits` 签名；`.ts` 的导出函数/类型；路由表条目。

### 忽略项

- `node_modules/`、`target/`（编译产物）、`.git/`、测试文件（`**/test/**`、`*.test.ts`）默认跳过，但 `design.md` 中可配置白名单。

## 产物结构（docs/wiki/）

### INDEX.md

```markdown
# Repo Wiki

> 自动生成于 <ISO 时间戳>，由 scripts/wiki-generator.ts 产出
> 范围：backend/ + frontend/

## 模块索引
- [架构总览](./architecture.md)
- [backend: todo 模块](./modules/backend-todo.md)
- [frontend: todo 视图](./modules/frontend-todo.md)
```

### architecture.md

- 文字 + ASCII 描述前后端分层与调用关系。

### modules/<module>.md

- 模块职责、关键文件清单、对外接口（API 路径 / 组件 props / 导出函数）、依赖的其他模块。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 大型仓库扫描慢 | 体验差 | mtime 增量 + 可配置 scope |
| 提取信息不准确 | Wiki 误导 | skill 中明确"脚本提取为骨架，AI 需校验" |
| 文档过期 | 与代码漂移 | INDEX 带时间戳；skill 提供 `/wiki:update` 增量刷新 |
