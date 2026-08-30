## Why

后端在 `align-response-dto-to-backend-conventions` 中将响应 DTO 改为 snake_case 字段 + 顶层 `request_id`（`BaseResponse` + `RequestIdFilter`）。`frontend/openapi/openapi.json` 已同步重生成（snake_case + `request_id`），但 `frontend/lib/api.generated.ts`（由 `openapi:gen` 生成）与 `frontend/lib/backend.ts`（BFF）仍反映旧的 camelCase 契约，形成**漂移**。

当前前端页面尚未消费这些响应类型（`fetchFromBackend` / `UserResponse` / `AuthTokenResponse` 等零引用，也无 MSW mock），故漂移**暂无功能影响**。但为保持契约单一真相来源、并为后续前端接入后端接口时直接使用正确的 snake_case / `request_id`，应在独立 change 中把前端类型同步到新契约。

## What Changes

- 运行 `npm run openapi:gen`，依据已更新的 `openapi/openapi.json` 重新生成 `lib/api.generated.ts`（snake_case 字段 + `request_id`）。
- 同步 `lib/backend.ts` 中重新导出的类型与 `fetchFromBackend` 泛型封装（如有必要）。
- 为 `request_id` 建立消费点：在 BFF 层将响应中的 `request_id` 取出，挂到日志 / 可观测上下文（如 `console` / 未来埋点），便于前后端链路对齐。
- 更新任何引用响应形状的 Vitest 测试 / MSW handler（当前查无，需运行后确认）。

## Impact

- 仅 `frontend/` 内文件；不改动后端，不改变 `openapi/openapi.json`。
- 风险低：当前无源码消费 API 类型，重生成类型不会造成编译中断；以 `npm run type-check` / `npm run build` 验证无回归。

## Non-Goals

- 不重写页面、不新增对后端接口的调用（待功能需求触发）。
- 不改 `openapi/openapi.json`（已由后端 change 完成）。
