CREATE TABLE IF NOT EXISTS `la_oem_merchant_brand` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(120) NOT NULL, `legacy` tinyint unsigned NOT NULL DEFAULT 0, `geo_scope` bigint unsigned NOT NULL DEFAULT 0,
 `logo_file_id` bigint unsigned NOT NULL DEFAULT 0, `cover_file_id` bigint unsigned NOT NULL DEFAULT 0,
 `contact` varchar(80) NOT NULL DEFAULT '', `mobile` varchar(32) NOT NULL DEFAULT '',
 `email` varchar(160) NOT NULL DEFAULT '', `address` varchar(255) NOT NULL DEFAULT '',
 `knowledge_json` mediumtext NOT NULL, `knowledge_revision` int unsigned NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL DEFAULT 1, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_brand_store` (
 `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL, `store_id` bigint unsigned NOT NULL, `brand_id` bigint unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`user_id`,`store_id`), KEY `brand` (`tenant_id`,`user_id`,`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
