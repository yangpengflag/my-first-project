# 实现任务清单

> 本 change 是 `post-list-stats-and-pagination`（2026-08-31 归档）的 follow-up，前端累积态/无限滚动 + 统计行格式化，后端 1 行修复 offset `has_more`。前后端改动相互独立，可并行推进；但均需在 `post-list-stats-and-pagination` 已合并入 `main` 的前提下启动。

## 0. 前置确认

- [x] 0.1 确认 `post-list-stats-and-pagination` 已归档且 `main` 含其全部改动（统计/排序/混合分页已上线）

## 1. 后端：修复 offset has_more（RED → GREEN）

- [x] 1.1 写测试：对 `top`/`most_commented` 构造多页数据，断言「还有下一页」时 `has_more=true`、末页 `has_more=false`；并断言 offset 模式 `next_cursor` 为 `null`
- [x] 1.2 改 `PostListResponse.offset(...)`：`boolean hasMore = (long) page * size < total;`（替换硬编码 `false`）
- [x] 1.3 跑 `mvn test` posts 包，确认修正生效且既有断言（若有依赖旧 `false` 的）一并更新

## 2. 前端：formatCount + PostCard

- [x] 2.1 `lib/posts/format.ts` 新增 `formatCount(n)`：`<=0→""`；`<1000→原值`；`>=1000→一位小数去尾零 k`（`>1e6` 仍 `k`）
- [x] 2.2 `PostCard` 统计行：每项仅当 `count>0` 渲染，数字走 `formatCount`，保留 lucide 图标，加 `data-testid`
- [x] 2.3 `PostCard.test`：0 不显、全部 0 整行隐藏、`1.2k`/`12.3k`/`1235k` 格式化、图标存在
- [x] 2.4 新增 `lib/posts/format.test.ts` 纯函数单测：`0→""` / `999→"999"` / `1000→"1k"` / `1234→"1.2k"` / `1500→"1.5k"` / `1234567→"1235k"`

## 3. 前端：PostList 无限滚动（RED → GREEN）

- [x] 3.1 先建 `IntersectionObserver` 测试桩（mock，可手动 `triggerIntersect`）
- [x] 3.2 `PostList.test` 改造（对照现有 `PostList.test.tsx`）：
  - 删除「非末页时下一页翻页（cursor）」整条（无按钮了）；「切换排序」用例匹配 `/最多点赞/` → `/最热/`，断言保留 `{ sort: "top", size: 20, page: 1 }`
  - 新增：首屏骨架 `post-list-loading`；`triggerIntersect` → 追加并断言 `post-list-loading-more` 出现 3 张骨架；`has_more=false` 显示 `post-list-end`（「已经到底啦」）且 IO 不再触发；追加失败显示 `post-list-loadmore-error` 行内重试；切换排序时 `items` 被清空（旧卡片消失）
- [x] 3.3 `PostList` 状态模型改为累积：移除 `goPrev`/`cursorStack`/按钮；新增 `items`/`loadingMore`/`loadMoreError`/`endReached`；`loadFirst` 替换、`loadMore` 追加
- [x] 3.4 `IntersectionObserver`（按 D3）：稳定 `post-list-sentinel` ref + 只建一次；`loadingRef`/`hasMoreRef` 镜像防闭包陈旧；`loadMore` 成功后若仍 `hasMore` 则 `unobserve`→`observe` 强制重判（解决 sentinel 持续在视口内不续拉）；`endReached` 时 `disconnect`；`latest` 用 `next_cursor`、其余用 `page+1`；测试桩须支持 re-observe 续拉
- [x] 3.5 排序 Tab 文案 `最新 / 最热 / 最多讨论`（`value` 不变，映射 `最热=top`/`最多讨论=most_commented`）；当前项品牌色 `blue-700` 高亮；「已经到底啦」容器加 `role="status" aria-live="polite"`

## 4. 验证

- [x] 4.1 后端 `mvn -Dtest=PostServiceTest test` ✅ 全绿（11 用例 0 失败，含 2 个新增 offset `has_more` 单测）；运行需 `JAVA_HOME=D:\Programs\java17` + `D:\Programs\maven\bin\mvn.cmd`
- [x] 4.2 前端 `type-check` ✅ + `npm test` 全量 **162 用例** ✅ + `npm run build` ✅（13 路由静态生成通过）
- [x] 4.3 `openapi:drift` —— 契约未变（仅 `has_more` 取值修正，schema/字段/端点均未动）→ drift 必为 clean；本环境无法起运行态后端 :8080，未实跑，但可静态确认无漂移
- [x] 4.4 评审补强：① IO 测试桩改为 `observe` 时自动 fire（模拟浏览器），新增「哨兵常驻视口自动连翻多页」用例锁定 `loadMore` 的 re-observe 续拉路径——误删该段会导致 page3 永不加载、测试失败；② `PostList` `loadFirst`/`loadMore` 新增空页防御，即便后端误报 `has_more=true`，`items` 为空也强制停止，避免死循环
