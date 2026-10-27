CREATE TABLE IF NOT EXISTS `la_oem_geo_monitor_run` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `cycle_id` bigint unsigned NOT NULL, `request_key` varchar(80) NOT NULL,
 `state` varchar(24) NOT NULL DEFAULT 'queued', `expected` int unsigned NOT NULL, `create_time` int unsigned NOT NULL, `finish_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `cycle_once` (`cycle_id`), UNIQUE KEY `owner_request` (`tenant_id`,`user_id`,`request_key`), KEY `owner` (`tenant_id`,`user_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_monitor_cell` (
 `job_id` bigint unsigned NOT NULL, `run_id` bigint unsigned NOT NULL, `provider_task_id` varchar(64) NOT NULL DEFAULT '',
 `next_at` int unsigned NOT NULL DEFAULT 0, `lease_until` int unsigned NOT NULL DEFAULT 0, `lease_token` varchar(40) NOT NULL DEFAULT '',
 PRIMARY KEY (`job_id`), KEY `poll_due` (`next_at`,`lease_until`), KEY `run` (`run_id`,`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_monitor_schedule` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `enabled` tinyint NOT NULL DEFAULT 0, `interval_days` int unsigned NOT NULL,
 `remaining_runs` int unsigned NOT NULL, `max_user_points` decimal(14,2) NOT NULL, `authority_stamp` char(64) NOT NULL,
 `plan_id` bigint unsigned NOT NULL, `next_at` int unsigned NOT NULL, `expires_at` int unsigned NOT NULL,
 `last_error` varchar(500) NOT NULL DEFAULT '', `revision` int unsigned NOT NULL DEFAULT 1, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `project_once` (`project_id`), KEY `due` (`enabled`,`next_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
