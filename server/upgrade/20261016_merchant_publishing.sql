CREATE TABLE IF NOT EXISTS `la_oem_film_library` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(80) NOT NULL, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_film_entry` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `asset_ref` varchar(96) NOT NULL, `library_id` bigint unsigned NOT NULL DEFAULT 0, `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `owner_ref` (`tenant_id`,`user_id`,`asset_ref`), KEY `library` (`tenant_id`,`user_id`,`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_film_destination` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `source` varchar(32) NOT NULL, `task_id` bigint unsigned NOT NULL DEFAULT 0, `library_id` bigint unsigned NOT NULL DEFAULT 0,
 `intent_key` varchar(64) NOT NULL, `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `intent` (`intent_key`), KEY `task` (`tenant_id`,`user_id`,`source`,`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_publish_task` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `request_key` varchar(64) NOT NULL, `title` varchar(80) NOT NULL, `content` varchar(500) NOT NULL,
 `config_json` mediumtext NOT NULL, `state` varchar(16) NOT NULL DEFAULT 'active', `due_time` int unsigned NOT NULL,
 `deadline` int unsigned NOT NULL, `create_time` int unsigned NOT NULL, `cancel_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `request` (`tenant_id`,`user_id`,`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_publish_assignment` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `task_id` bigint unsigned NOT NULL, `staff_id` bigint unsigned NOT NULL, `store_id` bigint unsigned NOT NULL,
 `platform` varchar(20) NOT NULL, `asset_ref` varchar(96) NOT NULL, `copy_text` text NOT NULL, `topics` text NOT NULL,
 `state` varchar(16) NOT NULL DEFAULT 'pending', `proof_url` varchar(2048) NOT NULL DEFAULT '', `note` varchar(500) NOT NULL DEFAULT '',
 `claim_time` int unsigned NOT NULL DEFAULT 0, `submit_time` int unsigned NOT NULL DEFAULT 0, `review_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), UNIQUE KEY `staff_platform` (`task_id`,`staff_id`,`platform`), KEY `owner` (`tenant_id`,`user_id`,`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_staff_task_access` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `staff_id` bigint unsigned NOT NULL,
 `token_hash` char(64) NOT NULL, `token_cipher` text NOT NULL, `appid` varchar(64) NOT NULL DEFAULT '', `openid_cipher` text NOT NULL,
 `subscribe` tinyint NOT NULL DEFAULT 0, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `staff` (`tenant_id`,`user_id`,`staff_id`), UNIQUE KEY `token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_task_oauth_state` (
 `state_hash` char(64) NOT NULL, `access_id` bigint unsigned NOT NULL, `config_revision` int NOT NULL, `source_tenant_id` int NOT NULL,
 `expire_time` int unsigned NOT NULL, PRIMARY KEY (`state_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_task_notification` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `task_id` bigint unsigned NOT NULL, `staff_id` bigint unsigned NOT NULL, `state` varchar(24) NOT NULL DEFAULT 'queued',
 `due_time` int unsigned NOT NULL, `attempts` int unsigned NOT NULL DEFAULT 0, `lease_until` int unsigned NOT NULL DEFAULT 0,
 `recipient_hash` char(64) NOT NULL DEFAULT '', `msgid` varchar(128) NOT NULL DEFAULT '', `error` varchar(255) NOT NULL DEFAULT '', `send_time` int unsigned NOT NULL DEFAULT 0,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `task_staff` (`task_id`,`staff_id`), KEY `queue` (`state`,`due_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_task_notification_quota` (
 `recipient_hash` char(64) NOT NULL, `day` char(8) NOT NULL, `attempts` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`recipient_hash`,`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
