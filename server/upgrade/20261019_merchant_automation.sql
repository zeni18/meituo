CREATE TABLE IF NOT EXISTS `la_oem_automation_plan` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(100) NOT NULL, `kind` varchar(16) NOT NULL, `state` varchar(16) NOT NULL DEFAULT 'paused',
 `config_json` longtext NOT NULL, `revision` int unsigned NOT NULL DEFAULT 1, `runs` int unsigned NOT NULL DEFAULT 0,
 `next_at` int unsigned NOT NULL DEFAULT 0, `expires_at` int unsigned NOT NULL, `last_error` varchar(500) NOT NULL DEFAULT '',
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`id`), KEY `due` (`state`,`next_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_automation_run` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `plan_id` bigint unsigned NOT NULL, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `sequence_no` int unsigned NOT NULL, `state` varchar(16) NOT NULL DEFAULT 'running', `stage` varchar(24) NOT NULL DEFAULT 'start',
 `budget_cents` bigint unsigned NOT NULL DEFAULT 0, `allocated_cents` bigint unsigned NOT NULL DEFAULT 0,
 `data_json` longtext NOT NULL, `note` varchar(500) NOT NULL DEFAULT '', `create_time` int unsigned NOT NULL, `finish_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `plan_run` (`plan_id`,`sequence_no`), KEY `owner` (`tenant_id`,`user_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_automation_link` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `run_id` bigint unsigned NOT NULL, `kind` varchar(16) NOT NULL,
 `object_id` bigint unsigned NOT NULL, `cost_cents` bigint unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `object_once` (`kind`,`object_id`), KEY `run` (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_automation_heartbeat` (
 `id` int unsigned NOT NULL, `beat_at` int unsigned NOT NULL, PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
