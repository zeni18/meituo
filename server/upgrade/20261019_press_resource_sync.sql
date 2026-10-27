CREATE TABLE IF NOT EXISTS `la_press_resource_sync` (
 `id` tinyint unsigned NOT NULL,
 `batch` char(32) NOT NULL DEFAULT '',
 `config_revision` int unsigned NOT NULL DEFAULT 0,
 `state` varchar(24) NOT NULL DEFAULT 'idle',
 `progress_json` mediumtext NOT NULL,
 `cursor_kind` tinyint unsigned NOT NULL DEFAULT 0,
 `lease_token` char(32) NOT NULL DEFAULT '',
 `lease_until` int unsigned NOT NULL DEFAULT 0,
 `worker_seen` int unsigned NOT NULL DEFAULT 0,
 `started_at` int unsigned NOT NULL DEFAULT 0,
 `updated_at` int unsigned NOT NULL DEFAULT 0,
 `finished_at` int unsigned NOT NULL DEFAULT 0,
 `actor_id` int unsigned NOT NULL DEFAULT 0,
 `message` varchar(255) NOT NULL DEFAULT '',
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO `la_press_resource_sync` (`id`,`progress_json`) VALUES (1,'[]');
