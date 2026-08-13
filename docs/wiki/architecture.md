# 架构总览

```
┌─────────────────────────┐      ┌─────────────────────────┐
│  Frontend (Vue 3 + TS)  │ ───▶ │  Backend (Spring Boot)  │
│  Frontend: misc 模块     │      │  Backend: core 模块      │
└─────────────────────────┘      └─────────────────────────┘
```

（脚本仅生成骨架，AI 在校验时补充分层说明与调用关系。）

## 已识别模块

- Backend: core 模块 (`backend/src/main/java/com/mooc/backend/`)
- Frontend: misc 模块 (`frontend/src/`)
- Frontend: components 模块 (`frontend/src/components/`)
- Frontend: router 模块 (`frontend/src/router/`)
- Frontend: stores 模块 (`frontend/src/stores/`)
- Frontend: views 模块 (`frontend/src/views/`)
