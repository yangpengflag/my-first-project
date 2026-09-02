# fix-email-verification — Proposal

## Why

注册验证邮件此前无法真实投递（SMTP 未配置 / 凭据来源混乱），且 `auth.mail.log-verification-code` 调试开关残留为 `true`，存在一次性凭证明文落日志的泄露风险。需固化「配置分层 + 生产安全」的邮件配置规范，并把本次修复纳入变更追踪。

## What / Scope

- **配置分层（核心）**：非敏感项（`host`/`port`/TLS）固化在 `application.yml`；敏感凭据（QQ 授权码）只经环境变量 `SPRING_MAIL_*` 或密钥管理（`Secret`/`.env`）注入，禁止入库。
- **日志开关生产安全化**：`auth.mail.log-verification-code` 默认 `false`；新增 `application-dev.yml`，本地调试用 dev profile 开启。
- **前端体验修复**：注册成功页增加「重新发送验证邮件」入口；验证失败页按 `error.code` 区分原因并支持邮箱重发。
- **文档**：README 补充生产部署配置说明（分层原则 / Docker / K8s / `FRONTEND_BASE_URL` 必须改为线上域名）。

## Out of Scope

- 外部采集 / AI 富化（属 `places-ingestion`，P5）。
- Post 地点关联（属 `post-location-tagging`，P6）。

## Impact

- `backend/src/main/resources/application.yml`、`application-dev.yml`（新增）、`backend/README.md`。
- `frontend`：注册成功页、验证结果页两个组件（已在先前回合实现）。
