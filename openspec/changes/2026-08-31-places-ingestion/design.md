# Design (places-ingestion)

- 采集：`CrawlerService` 拉取外部源 HTML/API → 提取结构化字段。
- 英译/结构化：`AiEnrichmentService` 调用 LLM，把中文/原始内容转成 `nameEn` / `summaryEn` / `descriptionEn` + 分类枚举（映射回 `nature`/...）+ `tags`。
- 落库：`SpotIngestionService.upsertBySlug(citySlug, spotSlug, payload)` 幂等（存在则更新，不存在则建）；City 同理。
- 调度：`@Scheduled(cron=...)` 周期触发；首跑执行 seed 脚本导入基线数据。
- 健壮性：采集失败不中断整体；单条失败记录日志并跳过；`rating` 由爬虫估算或留空。
