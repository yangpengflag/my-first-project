## 真相来源

`frontend/openapi/openapi.json` 已由后端 `align-response-dto-to-backend-conventions` 重生成，内容为 snake_case 字段 + 顶层 `request_id`。`lib/api.generated.ts` 由 `openapi:gen`（`openapi-typescript`）据此生成，故重跑即对齐。

## 步骤

1. **重生成类型**：`npm run openapi:gen` → 覆盖 `lib/api.generated.ts`。预期字段名变为 `display_name` / `avatar_url` / `created_at` / `request_id` 等，类型名（`UserResponse` / `AuthTokenResponse` / `PostResponse`）保持不变。
2. **静态校验**：`npm run type-check`（vue-tsc）与 `npm run build`。预期结果：green，无新增报错（当前无源码引用这些类型）。
3. **BFF 对齐**：检查 `lib/backend.ts` —— `fetchFromBackend<T>` 泛型与重新导出的类型是否随 `api.generated.ts` 自然对齐；如需显式暴露 `request_id`，在响应解析处取出并接入日志上下文。
4. **测试 / mock**：运行 `npm run test`，确认无 Vitest 用例或 MSW handler 依赖旧字段名；若有，改为 snake_case。
5. **验收**：`npm run test` 与 `npm run build` 全绿；`openapi:drift`（`scripts/sync-openapi.mjs --check`）通过。

## 风险与回滚

- 风险极低：drift 仅为类型定义层面的不一致，无运行期影响。
- 回滚：若生成结果异常，`git checkout lib/api.generated.ts` 即可恢复。
