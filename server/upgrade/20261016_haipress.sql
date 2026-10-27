CREATE TABLE IF NOT EXISTS `la_press_config` (
 `id` int unsigned NOT NULL, `enabled` tinyint NOT NULL DEFAULT 0,
 `revision` int unsigned NOT NULL DEFAULT 0, `markup_bps` int unsigned NOT NULL DEFAULT 0,
 `public_base` varchar(250) NOT NULL DEFAULT '', `secret_cipher` text NOT NULL, `account_hash` char(64) NOT NULL,
 `access_cipher` text NOT NULL, `access_expiry` int unsigned NOT NULL DEFAULT 0,
 `updated_by` int unsigned NOT NULL DEFAULT 0, `update_time` int unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_press_media` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `kind` tinyint unsigned NOT NULL,
 `source_id` varchar(120) NOT NULL, `name` varchar(255) NOT NULL,
 `region` varchar(120) NOT NULL DEFAULT '', `category` varchar(120) NOT NULL DEFAULT '',
 `cost_cents` bigint unsigned NOT NULL, `active` tinyint NOT NULL DEFAULT 0,
 `remark` text NOT NULL, `case_url` text NOT NULL,
 `config_revision` int unsigned NOT NULL, `sync_time` int unsigned NOT NULL,
 `sync_batch` char(32) NOT NULL DEFAULT '', `details_json` mediumtext NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `resource` (`kind`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_press_draft` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `tenant_id` int unsigned NOT NULL,
 `user_id` int unsigned NOT NULL, `title` varchar(255) NOT NULL, `body` mediumtext NOT NULL,
 `preview_hash` char(64) NOT NULL, `preview_cipher` text NOT NULL, `expires_at` int unsigned NOT NULL,
 `create_time` int unsigned NOT NULL, PRIMARY KEY (`id`),
 UNIQUE KEY `preview` (`preview_hash`), KEY `owner` (`tenant_id`,`user_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_press_order` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `sn` varchar(64) NOT NULL,
 `tenant_id` int unsigned NOT NULL, `user_id` int unsigned NOT NULL,
 `request_key` varchar(64) NOT NULL, `payload_hash` char(64) NOT NULL,
 `draft_id` bigint unsigned NOT NULL, `media_id` bigint unsigned NOT NULL,
 `title` varchar(255) NOT NULL, `media_name` varchar(255) NOT NULL,
 `source_id` varchar(120) NOT NULL, `cost_cents` bigint unsigned NOT NULL,
 `retail_cents` bigint unsigned NOT NULL, `points` decimal(14,2) NOT NULL,
 `config_revision` int unsigned NOT NULL, `account_hash` char(64) NOT NULL, `preview_url` text NOT NULL,
 `remark` text NOT NULL, `state` varchar(32) NOT NULL DEFAULT 'queued',
 `billing_status` varchar(24) NOT NULL DEFAULT 'reserved',
 `provider_flag` int NOT NULL DEFAULT -1, `published_url` text NOT NULL,
 `failure_reason` varchar(250) NOT NULL DEFAULT '', `refund_evidence` varchar(500) NOT NULL DEFAULT '',
 `lease_token` varchar(32) NOT NULL DEFAULT '', `lease_until` int unsigned NOT NULL DEFAULT 0,
 `next_poll` int unsigned NOT NULL DEFAULT 0, `attempted` tinyint NOT NULL DEFAULT 0,
 `process_flag` tinyint NOT NULL DEFAULT 0, `process_note` varchar(1000) NOT NULL DEFAULT '',
 `process_attempted` tinyint NOT NULL DEFAULT 0, `process_state` varchar(24) NOT NULL DEFAULT '',
 `create_time` int unsigned NOT NULL, `update_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`), UNIQUE KEY `sn` (`sn`),
 UNIQUE KEY `idempotency` (`tenant_id`,`user_id`,`request_key`,`media_id`),
 KEY `owner` (`tenant_id`,`user_id`,`id`), KEY `queue` (`state`,`next_poll`,`lease_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `la_press_audit` (
 `id` bigint unsigned NOT NULL AUTO_INCREMENT, `action` varchar(30) NOT NULL,
 `actor_id` int unsigned NOT NULL DEFAULT 0, `order_id` bigint unsigned NOT NULL DEFAULT 0,
 `note` varchar(500) NOT NULL DEFAULT '', `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
