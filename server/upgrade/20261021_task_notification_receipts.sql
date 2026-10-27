CREATE TABLE IF NOT EXISTS `la_oem_task_notification_event` (
 `app_id` varchar(32) NOT NULL, `msgid` varchar(128) NOT NULL, `recipient_hash` char(64) NOT NULL,
 `state` varchar(24) NOT NULL, `event_time` int unsigned NOT NULL, `create_time` int unsigned NOT NULL,
 PRIMARY KEY (`app_id`,`msgid`,`recipient_hash`), KEY `created` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
