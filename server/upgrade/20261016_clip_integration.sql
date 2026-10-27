CREATE TABLE IF NOT EXISTS `la_oem_clip_integration` (
 `tenant_id` int unsigned NOT NULL DEFAULT 0,
 `capability` varchar(20) NOT NULL,
 `enabled` tinyint unsigned NOT NULL DEFAULT 0,
 `settings_json` text NOT NULL,
 `secret_cipher` text NOT NULL,
 `revision` int unsigned NOT NULL DEFAULT 1,
 `is_deleted` tinyint unsigned NOT NULL DEFAULT 0,
 `updated_by` int unsigned NOT NULL DEFAULT 0,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_clip_borrow_policy` (
 `tenant_id` int unsigned NOT NULL,
 `allow_platform` tinyint unsigned NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL DEFAULT 1,
 `updated_by` int unsigned NOT NULL DEFAULT 0,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_clip_config_audit` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `tenant_id` int unsigned NOT NULL DEFAULT 0,
 `capability` varchar(20) NOT NULL,
 `action` varchar(24) NOT NULL,
 `actor_id` int unsigned NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL,
 `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
