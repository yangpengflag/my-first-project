-- 一次性迁移：posts.spot_ids (JSON 列) -> post_spots 关联表（替代 P6 的多 POI 关联实现）
-- 本地 MySQL 已执行（migrated rows: 0，开发库无旧数据）；此为可复跑记录，供其他环境使用。
-- 执行前提：应用已用 ddl-auto=update 启动过（post_spots 表由 PostSpot 实体自动创建），
--          或先跑下方 CREATE TABLE IF NOT EXISTS 兜底。

CREATE TABLE IF NOT EXISTS post_spots (
    id binary(16) NOT NULL,
    post_id binary(16) NOT NULL,
    spot_slug varchar(255) NOT NULL,
    created_at datetime(6),
    updated_at datetime(6),
    deleted bit(1) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_post_spots_post_spot (post_id, spot_slug),
    KEY idx_post_spots_spot (spot_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO post_spots (id, post_id, spot_slug, created_at, updated_at, deleted)
SELECT UUID_TO_BIN(UUID()), p.id, JSON_UNQUOTE(je.spot), NOW(), NOW(), 0
FROM posts p
CROSS JOIN JSON_TABLE(p.spot_ids, '$[*]' COLUMNS (spot VARCHAR(255) PATH '$')) je
WHERE p.deleted = false AND JSON_LENGTH(p.spot_ids) > 0
ON DUPLICATE KEY UPDATE spot_slug = VALUES(spot_slug);

ALTER TABLE posts DROP COLUMN spot_ids;
