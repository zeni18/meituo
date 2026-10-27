CREATE TABLE IF NOT EXISTS `la_oem_geo_profile` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL,
 `user_id` int unsigned NOT NULL, `brand_name` varchar(120) NOT NULL DEFAULT '',
 `website` varchar(500) NOT NULL DEFAULT '', `industry` varchar(120) NOT NULL DEFAULT '',
 `intro` text NOT NULL, `products` text NOT NULL, `customers` text NOT NULL, `competitors` text NOT NULL,
 `revision` int unsigned NOT NULL DEFAULT 0, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `owner` (`tenant_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
