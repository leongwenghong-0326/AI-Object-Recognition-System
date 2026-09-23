-- AI + AR Smart Object Recognition System
-- Local MySQL scan history schema (XAMPP / MySQL 8+)
--
-- Import in phpMyAdmin or MySQL CLI for local use.
-- Then set in config: db_driver = mysql, db_name = ai_ar_scanner
CREATE DATABASE IF NOT EXISTS ai_ar_scanner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_ar_scanner;

CREATE TABLE IF NOT EXISTS scan_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  object_label VARCHAR(120) NOT NULL DEFAULT '',
  product_name VARCHAR(255) NOT NULL DEFAULT '',
  manufacturer VARCHAR(120) NOT NULL DEFAULT '',
  specification VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NULL,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  provider VARCHAR(40) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_created_at (created_at),
  KEY idx_product_name (product_name),
  KEY idx_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;