## 1. 重生成前端 API 类型
- [ ] 1.1 运行 `npm run openapi:gen`，确认 `lib/api.generated.ts` 使用 snake_case 字段 + `request_id`
- [ ] 1.2 提交 `lib/api.generated.ts` 更新

## 2. 静态校验
- [ ] 2.1 `npm run type-check` 通过
- [ ] 2.2 `npm run build` 通过，无回归

## 3. BFF 与 request_id
- [ ] 3.1 检查 `lib/backend.ts` 类型导出与 `fetchFromBackend` 泛型是否对齐新契约
- [ ] 3.2 在 BFF 层取出响应 `request_id` 并接入日志 / 可观测上下文

## 4. 测试与 mock
- [ ] 4.1 运行 `npm run test`，确认无用例 / MSW 依赖旧字段名
- [ ] 4.2 若发现引用，统一改写为 snake_case

## 5. 验收与归档
- [ ] 5.1 `npm run test` 与 `npm run build` 全绿
- [ ] 5.2 `openapi:drift` 校验通过
- [ ] 5.3 归档本 change
