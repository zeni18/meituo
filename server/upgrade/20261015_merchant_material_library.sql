CREATE TABLE IF NOT EXISTS `la_oem_material_folder` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `kind` varchar(20) NOT NULL, `parent_id` bigint unsigned NOT NULL DEFAULT 0, `name` varchar(60) NOT NULL,
 `sort` int NOT NULL DEFAULT 0, `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 `delete_time` int unsigned NOT NULL DEFAULT 0, PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`kind`,`delete_time`,`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_material_label` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `name` varchar(30) NOT NULL, `color` varchar(16) NOT NULL DEFAULT 'mint', `create_time` int unsigned NOT NULL,
 `update_time` int unsigned NOT NULL, `delete_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), KEY `owner` (`tenant_id`,`user_id`,`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_oem_material_meta` (
 `material_id` bigint unsigned NOT NULL, `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `folder_id` bigint unsigned NOT NULL DEFAULT 0, `label_ids` text NOT NULL,
 `update_time` int unsigned NOT NULL, PRIMARY KEY (`material_id`), KEY `owner` (`tenant_id`,`user_id`,`folder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
