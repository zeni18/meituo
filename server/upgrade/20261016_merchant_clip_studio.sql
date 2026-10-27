CREATE TABLE IF NOT EXISTS `la_oem_clip_document` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `kind` varchar(16) NOT NULL,
  `name` varchar(100) NOT NULL,
  `mode` varchar(16) NOT NULL,
  `revision` int unsigned NOT NULL DEFAULT 1,
  `config_json` mediumtext NOT NULL,
  `create_time` int unsigned NOT NULL,
  `update_time` int unsigned NOT NULL,
  `delete_time` int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `owner_list` (`tenant_id`,`user_id`,`kind`,`delete_time`,`update_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `la_oem_clip_plan` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `project_id` bigint unsigned NOT NULL,
  `revision` int unsigned NOT NULL,
  `plan_hash` char(64) NOT NULL,
  `plan_json` mediumtext NOT NULL,
  `create_time` int unsigned NOT NULL,
  `delete_time` int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_plan` (`project_id`,`revision`,`plan_hash`),
  KEY `owner_project` (`tenant_id`,`user_id`,`project_id`,`delete_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
