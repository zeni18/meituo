CREATE TABLE IF NOT EXISTS `la_oem_merchant_store_design` (
 `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `store_id` bigint unsigned NOT NULL,
 `config` mediumtext NOT NULL, `revision` int unsigned NOT NULL DEFAULT 1, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`user_id`,`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_store_design_template` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(60) NOT NULL, `config` mediumtext NOT NULL, `revision` int unsigned NOT NULL DEFAULT 1,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
