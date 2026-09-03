# places-ingestion — Proposal (P5)

## Why

`api-spots` 建好空库后，需要数据来源。按产品决策：前期 mock、后期由 **AI 爬虫定时采集 + 英译** 填充并更新 City/Spot。

## Scope

- 爬虫采集外部源（旅游站/百科/OTA）→ 结构化。
- AI enrichment：生成英文 `nameEn` / `summaryEn` / `descriptionEn`，双语落库。
- 定时任务（`@Scheduled`）周期更新；幂等 upsert（按复合 slug）。
- 初始种子数据导入脚本（首批城市/景点）。

## Out of Scope

- CMS 编辑后台（project out-of-scope；数据由爬虫 + 种子驱动，无编辑后台）。
- 交互式地图（静态位置 + 外链即可）。

## Impact

- 新增后端 `places-ingestion` 子系统（crawler + AI client + scheduler）。
- 写入 `api-spots` 建立的 City/Spot 表。
- 依赖 `api-spots` 已合并。
