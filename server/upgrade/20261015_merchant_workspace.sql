CREATE TABLE IF NOT EXISTS `la_oem_merchant_store` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(80) NOT NULL, `address` varchar(255) NOT NULL DEFAULT '', `contact` varchar(50) NOT NULL DEFAULT '',
 `mobile` varchar(32) NOT NULL DEFAULT '', `business_hours` varchar(100) NOT NULL DEFAULT '', `description` text NOT NULL,
 `status` tinyint unsigned NOT NULL DEFAULT 1, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 `delete_time` int unsigned NOT NULL DEFAULT 0, PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_material` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `store_id` bigint unsigned NOT NULL DEFAULT 0, `kind` varchar(20) NOT NULL, `name` varchar(100) NOT NULL,
 `content` text NOT NULL, `file_ids` text NOT NULL, `tags` varchar(255) NOT NULL DEFAULT '',
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL, `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`kind`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_merchant_seedcard` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `store_id` bigint unsigned NOT NULL, `name` varchar(100) NOT NULL, `material_id` bigint unsigned NOT NULL,
 `topic_id` bigint unsigned NOT NULL DEFAULT 0, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 `delete_time` int unsigned NOT NULL DEFAULT 0, PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
