# Brief: homepage-hero

## 一句话描述
首页顶部品牌主视觉区：背景图、品牌标语、副标题与 AI 搜索框。

## 功能边界
- 包含：品牌背景图（next/image）、品牌标语 "Discover China Like a Local"、副标题 "Your AI-powered travel companion for exploring China"、搜索输入框（placeholder 为 "Search destinations, tips, or ask AI..."）、搜索按钮。
- 不包含：搜索后端服务、AI 对话逻辑、页面导航。

## 数据依赖
- 静态文案与背景图。
- 搜索框当前仅做 UI，提交动作可接后续 change。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell。
- 下游：homepage-ai-launcher（可选，搜索可唤起 AI）。