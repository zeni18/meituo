CREATE TABLE IF NOT EXISTS `la_oem_agent_account` (
 `agent_id` bigint unsigned NOT NULL,
 `tenant_id` int NOT NULL,
 `account` varchar(30) NOT NULL,
 `password_hash` varchar(255) NOT NULL,
 `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`agent_id`), UNIQUE KEY `tenant_account` (`tenant_id`,`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_agent_session` (
 `token_hash` char(64) NOT NULL,
 `tenant_id` int NOT NULL,
 `agent_id` bigint unsigned NOT NULL,
 `expire_time` int unsigned NOT NULL,
 `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`token_hash`), KEY `tenant_agent` (`tenant_id`,`agent_id`), KEY `expiry` (`expire_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
