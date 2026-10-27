CREATE TABLE IF NOT EXISTS `la_oem_geo_project` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `request_key` varchar(80) NOT NULL, `title` varchar(255) NOT NULL, `state` varchar(24) NOT NULL DEFAULT 'setup',
 `revision` int unsigned NOT NULL DEFAULT 1, `config_json` mediumtext NOT NULL, `active_plan_id` bigint unsigned NOT NULL DEFAULT 0,
 `draft_plan_id` bigint unsigned NOT NULL DEFAULT 0, `next_report_at` int unsigned NOT NULL DEFAULT 0,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `request_owner` (`tenant_id`,`user_id`,`request_key`), KEY `report_due` (`state`,`next_report_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_cycle` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL, `project_id` bigint unsigned NOT NULL,
 `cycle_no` int unsigned NOT NULL, `state` varchar(16) NOT NULL DEFAULT 'open', `report_json` mediumtext NOT NULL,
 `create_time` int unsigned NOT NULL, `close_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `project_cycle` (`project_id`,`cycle_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_sample` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `cycle_id` bigint unsigned NOT NULL, `evidence_id` bigint unsigned NOT NULL,
 `sample_hash` char(64) NOT NULL, `data_json` mediumtext NOT NULL, `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `cycle_sample` (`cycle_id`,`sample_hash`), KEY `owner_project` (`tenant_id`,`user_id`,`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_plan` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `version` int unsigned NOT NULL, `cycle_id` bigint unsigned NOT NULL,
 `state` varchar(16) NOT NULL DEFAULT 'draft', `data_json` mediumtext NOT NULL, `approved_at` int unsigned NOT NULL DEFAULT 0,
 `create_time` int unsigned NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `plan_version` (`project_id`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_action` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `plan_id` bigint unsigned NOT NULL, `kind` varchar(16) NOT NULL,
 `title` varchar(255) NOT NULL, `state` varchar(16) NOT NULL DEFAULT 'todo', `note` text NOT NULL,
 `data_json` text NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), KEY `owner_plan` (`tenant_id`,`user_id`,`project_id`,`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_action_link` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `action_id` bigint unsigned NOT NULL, `kind` varchar(16) NOT NULL, `object_id` bigint unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `action_object` (`action_id`,`kind`,`object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_progress_report` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `project_id` bigint unsigned NOT NULL, `due_at` int unsigned NOT NULL, `data_json` mediumtext NOT NULL, `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `project_due` (`project_id`,`due_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
