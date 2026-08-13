# Frontend: components 模块

> 来源目录: `frontend/src/components/`
> 范围: frontend

## 职责
可复用的 UI 组件库。包含脚手架默认组件（HelloWorld、TheWelcome、WelcomeItem）与图标集（icons/），被 views 与 App 组合使用，不直接持有业务状态。

## 关键文件

| 文件 | 主要符号 |
|------|----------|
| `frontend/src/components/HelloWorld.vue` | Vue SFC、props: {
  msg: string
} |
| `frontend/src/components/icons/IconCommunity.vue` | — |
| `frontend/src/components/icons/IconDocumentation.vue` | — |
| `frontend/src/components/icons/IconEcosystem.vue` | — |
| `frontend/src/components/icons/IconSupport.vue` | — |
| `frontend/src/components/icons/IconTooling.vue` | — |
| `frontend/src/components/TheWelcome.vue` | Vue SFC |
| `frontend/src/components/WelcomeItem.vue` | — |

## 依赖

- WelcomeItem
- IconDocumentation
- IconTooling
- IconEcosystem
- IconCommunity
- IconSupport
