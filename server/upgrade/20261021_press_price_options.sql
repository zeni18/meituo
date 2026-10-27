ALTER TABLE `la_press_order` ADD COLUMN `price_type` tinyint unsigned NOT NULL DEFAULT 1;
ALTER TABLE `la_press_order` ADD COLUMN `origin` varchar(1000) NOT NULL DEFAULT '';
