# Tasks — fix-email-verification

## 1. 配置分层与代码

- [x] 1.1 `application.yml`：移除易误导的 `SMTP_USERNAME/PASSWORD` 占位，仅保留非敏感 `port: 465` 与 TLS；host/username/password 改由 `SPRING_MAIL_*` 环境变量注入
- [x] 1.2 前端注册成功页「重新发送验证邮件」入口（先前实现）
- [x] 1.3 前端验证失败页按 `error.code` 区分原因 + 邮箱重发（先前实现）
- [x] 1.4 `log-verification-code` 默认改 `false`，新增 `application-dev.yml`（dev profile 置 `true`）
- [x] 1.5 `.gitignore` 忽略 `.env.dev` / `.env.prod`，保留 `.env.example` 入库
- [x] 1.6 新增 `.env.dev` / `.env.prod` / `.env.example`，集中邮箱/DB/JWT/CORS 等环境变量（敏感值不入库）
- [x] 1.7 新增 `application-prod.yml`（关闭文档 + 日志开关 false），inline prod 段从 `application.yml` 迁出
- [x] 1.8 新增 `run.sh` / `run.ps1`：读取 `.env.<profile>` 并注入后，以 `SPRING_PROFILES_ACTIVE=<profile>` 启动 `mvn spring-boot:run`
- [x] 1.9 README 补「按环境加载配置（.env.dev / .env.prod）」运行说明

## 2. 文档

- [x] 2.1 README 补「配置分层原则 / 生产部署（Docker·K8s）/ 日志开关 / FRONTEND_BASE_URL 必须改线上域名」
- [x] 2.2 提交 `backend/` 子模块指针（本 change 收尾）

## 3. 验证

- [x] 3.1 后端 `mvn test` 全绿（含 `LoggingMailSenderTest` 默认不打印码断言）
- [x] 3.2 前端 `npm run type-check && npm run test` 全绿
- [x] 3.3 归档本 change
