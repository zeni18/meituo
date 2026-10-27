CREATE TABLE IF NOT EXISTS `la_oem_merchant_store_meta` (
 `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `store_id` bigint unsigned NOT NULL,
 `logo_file_id` bigint unsigned NOT NULL DEFAULT 0,
 `province` varchar(50) NOT NULL DEFAULT '', `city` varchar(50) NOT NULL DEFAULT '', `district` varchar(50) NOT NULL DEFAULT '',
 `coordinates` varchar(64) NOT NULL DEFAULT '', `poi_id` varchar(128) NOT NULL DEFAULT '',
 `expire_time` int unsigned NOT NULL DEFAULT 0, `decoration` text NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`user_id`,`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_store_request` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `store_id` bigint unsigned NOT NULL,
 `kind` varchar(16) NOT NULL, `status` varchar(16) NOT NULL DEFAULT 'pending', `note` varchar(500) NOT NULL DEFAULT '',
 `review_note` varchar(500) NOT NULL DEFAULT '', `reviewer_type` varchar(16) NOT NULL DEFAULT '', `reviewer_id` int unsigned NOT NULL DEFAULT 0,
 `result` text NOT NULL, `create_time` int unsigned NOT NULL, `review_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner_store` (`tenant_id`,`user_id`,`store_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_store_staff` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `store_id` bigint unsigned NOT NULL,
 `name` varchar(50) NOT NULL, `mobile` varchar(32) NOT NULL, `status` tinyint unsigned NOT NULL DEFAULT 1,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner_store` (`tenant_id`,`user_id`,`store_id`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
