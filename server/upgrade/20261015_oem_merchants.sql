CREATE TABLE IF NOT EXISTS `la_oem_agent` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `tenant_id` int NOT NULL,
 `name` varchar(80) NOT NULL,
 `level` tinyint unsigned NOT NULL DEFAULT 1,
 `parent_id` bigint unsigned NOT NULL DEFAULT 0,
 `contact` varchar(50) NOT NULL DEFAULT '',
 `mobile` varchar(32) NOT NULL DEFAULT '',
 `status` tinyint unsigned NOT NULL DEFAULT 1,
 `notes` varchar(500) NOT NULL DEFAULT '',
 `create_time` int unsigned NOT NULL,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), KEY `tenant_parent` (`tenant_id`,`parent_id`), KEY `tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `tenant_id` int NOT NULL,
 `user_id` int unsigned NOT NULL,
 `name` varchar(80) NOT NULL,
 `contact` varchar(50) NOT NULL DEFAULT '',
 `mobile` varchar(32) NOT NULL DEFAULT '',
 `industry` varchar(50) NOT NULL DEFAULT '',
 `agent_id` bigint unsigned NOT NULL DEFAULT 0,
 `status` tinyint unsigned NOT NULL DEFAULT 1,
 `notes` varchar(500) NOT NULL DEFAULT '',
 `create_time` int unsigned NOT NULL,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `tenant_owner` (`tenant_id`,`user_id`), KEY `tenant_agent` (`tenant_id`,`agent_id`), KEY `tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Preserve existing AI account IDs, balances, assets and task ownership.
INSERT IGNORE INTO `la_oem_merchant` (`tenant_id`,`user_id`,`name`,`contact`,`mobile`,`status`,`create_time`,`update_time`)
SELECT `tenant_id`,`id`,LEFT(COALESCE(NULLIF(`nickname`,''),NULLIF(`account`,''),CONCAT('商家 ',`id`)),80),LEFT(`real_name`,50),`mobile`,IF(`is_disable`=1,0,1),`create_time`,UNIX_TIMESTAMP()
FROM `la_user` WHERE `delete_time` IS NULL;
