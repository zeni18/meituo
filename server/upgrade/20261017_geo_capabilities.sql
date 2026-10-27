CREATE TABLE IF NOT EXISTS `la_oem_geo_connection` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL DEFAULT 0, `agent_id` int unsigned NOT NULL DEFAULT 0,
 `capability` varchar(40) NOT NULL, `mode` varchar(16) NOT NULL DEFAULT 'off', `settings_json` text, `secret_cipher` text,
 `revision` int unsigned NOT NULL DEFAULT 1, `updated_by` int unsigned NOT NULL DEFAULT 0, `update_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `owner_capability` (`tenant_id`,`agent_id`,`capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_grant` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `agent_id` int unsigned NOT NULL DEFAULT 0,
 `capability` varchar(40) NOT NULL, `allow_use` tinyint NOT NULL DEFAULT 0, `allow_configure` tinyint NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL DEFAULT 1, `updated_by` int unsigned NOT NULL DEFAULT 0, `update_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `target_capability` (`tenant_id`,`agent_id`,`capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_audit` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL DEFAULT 0, `agent_id` int unsigned NOT NULL DEFAULT 0,
 `capability` varchar(40) NOT NULL, `action` varchar(40) NOT NULL, `actor_id` int unsigned NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL, `create_time` int unsigned NOT NULL, PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_material` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `title` varchar(255) NOT NULL, `category` varchar(80) NOT NULL DEFAULT '', `content` mediumtext, `source_url` varchar(2048) NOT NULL DEFAULT '',
 `revision` int unsigned NOT NULL DEFAULT 1, `delete_time` int unsigned NOT NULL DEFAULT 0,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_geo_job` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `request_key` varchar(80) NOT NULL, `input_hash` char(64) NOT NULL, `operation` varchar(40) NOT NULL, `status` varchar(32) NOT NULL DEFAULT 'queued',
 `payload_json` mediumtext, `authority_json` text, `result_json` mediumtext, `error` varchar(500) NOT NULL DEFAULT '',
 `consumption_id` bigint unsigned NOT NULL DEFAULT 0, `app_task_id` bigint unsigned NOT NULL DEFAULT 0,
 `started_at` int unsigned NOT NULL DEFAULT 0, `finish_time` int unsigned NOT NULL DEFAULT 0,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, PRIMARY KEY (`id`),
 UNIQUE KEY `request_owner` (`tenant_id`,`user_id`,`request_key`), KEY `queue` (`status`,`id`), KEY `owner` (`tenant_id`,`user_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
