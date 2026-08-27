# Brief: homepage-hot-posts

## 一句话描述
首页社区精选：3-4 条 UGC 帖子摘要（头像、用户名、标题、摘要、点赞数）。

## 功能边界
- 包含：帖子摘要列表/卡片、用户头像、用户名、帖子标题、内容摘要、点赞数、跳转入口。
- 不包含：发帖编辑器、帖子详情页、评论功能、用户关注。

## 数据依赖
- 初期：静态 JSON mock 数据。
- 后续：可替换为 `/api/posts` 或社区 API。

## 依赖关系
- 上游：frontend-styling-stack、homepage-shell。
- 下游：无（被 homepage 页面组合）。