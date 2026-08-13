# Backend: core 模块

> 来源目录: `backend/src/main/java/com/mooc/backend/`
> 范围: backend

## 职责
Spring Boot 应用入口与 REST 端点集合。`BackendApplication` 为启动类；`HelloController` 提供基础 HTTP 接口，是当前后端仅有的业务入口。

## 关键文件

| 文件 | 主要符号 |
|------|----------|
| `backend/src/main/java/com/mooc/backend/BackendApplication.java` | class BackendApplication |
| `backend/src/main/java/com/mooc/backend/HelloController.java` | @RestController、class HelloController、hello() |

## 依赖

- RestController
