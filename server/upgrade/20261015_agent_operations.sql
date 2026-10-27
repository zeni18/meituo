CREATE TABLE IF NOT EXISTS `la_oem_agent_wallet` (
 `tenant_id` int NOT NULL,
 `agent_id` bigint unsigned NOT NULL,
 `balance` decimal(12,2) NOT NULL DEFAULT 0,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_agent_operation` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `sn` varchar(32) NOT NULL,
 `tenant_id` int NOT NULL,
 `actor_agent_id` bigint unsigned NOT NULL DEFAULT 0,
 `admin_id` int unsigned NOT NULL DEFAULT 0,
 `merchant_id` bigint unsigned NOT NULL DEFAULT 0,
 `user_id` int unsigned NOT NULL DEFAULT 0,
 `target_agent_id` bigint unsigned NOT NULL DEFAULT 0,
 `kind` varchar(24) NOT NULL,
 `points` decimal(12,2) NOT NULL DEFAULT 0,
 `amount` decimal(10,2) NOT NULL DEFAULT 0,
 `request_key` varchar(64) NOT NULL,
 `payload_hash` char(64) NOT NULL,
 `detail` longtext NOT NULL,
 `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `sn` (`sn`),
 UNIQUE KEY `request` (`tenant_id`,`actor_agent_id`,`request_key`),
 KEY `merchant` (`tenant_id`,`merchant_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_agent_wallet_log` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `tenant_id` int NOT NULL,
 `agent_id` bigint unsigned NOT NULL,
 `operation_id` bigint unsigned NOT NULL,
 `delta` decimal(12,2) NOT NULL,
 `balance` decimal(12,2) NOT NULL,
 `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), KEY `agent` (`tenant_id`,`agent_id`,`id`),
 UNIQUE KEY `entry` (`operation_id`,`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_app_access` (
 `tenant_id` int NOT NULL,
 `user_id` int unsigned NOT NULL,
 `app_codes` longtext NOT NULL,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
