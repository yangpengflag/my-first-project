# Tasks — places-ingestion (P5)

- [ ] 5.1 `CrawlerService`：采集外部源 → 结构化字段
- [ ] 5.2 `AiEnrichmentService`：生成英文文案 + 分类/tags 映射
- [ ] 5.3 `SpotIngestionService` / `CityIngestionService`：按复合 slug 幂等 upsert
- [ ] 5.4 `@Scheduled` 定时任务周期更新
- [ ] 5.5 初始种子导入脚本（首批城市/景点）
- [ ] 5.6 单测：采集解析 + 英译字段非空 + slug 唯一/幂等
