CREATE TABLE IF NOT EXISTS `la_oem_finished_library_setting` (
 `tenant_id` int NOT NULL, `user_id` int unsigned NOT NULL,
 `kind` varchar(20) NOT NULL, `library_id` bigint unsigned NOT NULL,
 `max_uses` int unsigned NOT NULL DEFAULT 0, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`tenant_id`,`user_id`,`kind`,`library_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
