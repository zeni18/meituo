CREATE TABLE IF NOT EXISTS `la_oem_geo_resource` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT,
 `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `kind` varchar(24) NOT NULL, `title` varchar(255) NOT NULL,
 `content` mediumtext NOT NULL, `data_json` text NOT NULL,
 `revision` int unsigned NOT NULL DEFAULT 1,
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner_kind` (`tenant_id`,`user_id`,`kind`,`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
