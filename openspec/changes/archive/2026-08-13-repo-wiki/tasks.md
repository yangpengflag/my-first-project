# 施工排期：仓库知识库 (Repo Wiki)

## 脚本任务

### 1. 创建 wiki-generator 脚手架
- **文件**: `scripts/wiki-generator.ts`
- **操作**: 建立 CLI 入口，支持 `--scope=backend,frontend`（默认全扫）、`--out=docs/wiki`、`--incremental` 参数；配置 ignore 列表（node_modules/target/.git/测试）。
- **验证**: `npx tsx scripts/wiki-generator.ts --help` 输出用法。

### 2. 实现 backend 扫描器
- **文件**: `scripts/wiki-generator.ts`（或拆 `scripts/scanners/backend.ts`）
- **操作**: 递归扫描 `backend/src/main/java`，提取包结构、类/接口、注解、公开方法签名，归并到模块。
- **验证**: 对当前 backend 跑出含 Todo 模块的 `modules/backend-todo.md`。

### 3. 实现 frontend 扫描器
- **文件**: `scripts/scanners/frontend.ts`
- **操作**: 扫描 `frontend/src`，按 views/components/stores/router/api 划分，提取组件 props/emits、导出、路由。
- **验证**: 跑出 `modules/frontend-todo.md`。

### 4. 生成 INDEX 与 architecture
- **文件**: 同上
- **操作**: 汇总模块清单生成 `INDEX.md`（带时间戳）与 `architecture.md`（ASCII 分层）。
- **验证**: `docs/wiki/INDEX.md` 与 `architecture.md` 存在且链接有效。

### 5. 增量更新支持
- **文件**: 同上
- **操作**: 记录各模块源文件 mtime，仅重生成变化的模块文档；INDEX 时间戳刷新。
- **验证**: 改动一个文件后重跑，仅对应模块文档更新。

## 技能任务

### 6. 创建 repo-wiki skill
- **文件**: `.codebuddy/skills/repo-wiki/SKILL.md`
- **操作**: 定义 SOP：生成（`tsx` 跑脚本）、增量更新（`--incremental`）、检索（先读 INDEX 再定位模块）、以及"脚本提取为骨架，AI 校验并补自然语言叙述"的约定。
- **验证**: skill 可被加载，README 说明调用方式。

## 验证任务

### 7. 端到端验证
- **操作**: 运行 `npx tsx scripts/wiki-generator.ts`，确认 `docs/wiki/` 全部产物生成且内部链接可达。
- **验证**: 手动打开 INDEX.md 检查模块覆盖完整。

## 后续

- [ ] 归档变更 `0004-repo-wiki`
- [ ] （可选）在 README 增加 Wiki 使用说明
- [ ] （可选）后续 change 接入 CI 自动生成
