# Brief: homepage-ai-launcher

## 一句话描述
首页 AI 助手悬浮入口：右下角固定按钮，点击展开迷你对话窗。

## 功能边界
- 包含：固定悬浮按钮、点击展开/收起迷你对话窗、对话窗标题、输入框、占位欢迎语、关闭按钮。
- 不包含：真实 AI 后端对话服务（本单元只做 UI 入口与状态管理）。

## 数据依赖
- 静态欢迎语与占位回复。
- 实际对话由后续 AI 服务 change 提供。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell。
- 下游：AI 对话服务（后续独立 change）。