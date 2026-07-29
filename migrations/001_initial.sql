CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  terms_accepted_at DATETIME(3) NOT NULL,
  privacy_accepted_at DATETIME(3) NOT NULL,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  current_workspace_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_users_status (status),
  INDEX idx_users_workspace (current_workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspaces (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  image_url VARCHAR(500) NULL,
  time_zone VARCHAR(80) NOT NULL DEFAULT 'America/Sao_Paulo',
  publishing_paused BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_workspaces_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_current_workspace
  FOREIGN KEY (current_workspace_id) REFERENCES workspaces(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner', 'editor', 'reviewer') NOT NULL DEFAULT 'owner',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT fk_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type ENUM('email_verification', 'password_reset', 'data_export') NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_tokens_lookup (type, token_hash, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_states (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  state_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_oauth_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_channels (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  platform ENUM('facebook', 'instagram') NOT NULL,
  external_id VARCHAR(190) NOT NULL,
  name VARCHAR(190) NOT NULL,
  username VARCHAR(190) NULL,
  avatar_url VARCHAR(500) NULL,
  account_type VARCHAR(80) NULL,
  associated_page_id VARCHAR(190) NULL,
  encrypted_access_token TEXT NULL,
  encrypted_refresh_token TEXT NULL,
  token_expires_at DATETIME(3) NULL,
  permissions JSON NULL,
  status ENUM(
    'connected',
    'expiring',
    'expired',
    'insufficient_permission',
    'disconnected',
    'error',
    'review'
  ) NOT NULL DEFAULT 'connected',
  status_message VARCHAR(500) NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at DATETIME(3) NULL,
  disconnected_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_channels_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE KEY uq_channels_external (workspace_id, platform, external_id),
  INDEX idx_channels_status (workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  uploaded_by CHAR(36) NOT NULL,
  media_type ENUM('image', 'video') NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(600) NOT NULL,
  thumbnail_path VARCHAR(600) NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  duration_seconds DECIMAL(10, 2) NULL,
  processing_status ENUM('processing', 'ready', 'failed') NOT NULL DEFAULT 'processing',
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  CONSTRAINT fk_media_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_media_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_media_workspace (workspace_id, created_at),
  INDEX idx_media_type (workspace_id, media_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  author_id CHAR(36) NOT NULL,
  base_caption TEXT NULL,
  status ENUM(
    'draft',
    'scheduled',
    'processing',
    'published',
    'partially_published',
    'failed',
    'cancelled'
  ) NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME(3) NULL,
  scheduled_time_zone VARCHAR(80) NULL,
  published_at DATETIME(3) NULL,
  last_error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  CONSTRAINT fk_posts_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_posts_calendar (workspace_id, scheduled_at),
  INDEX idx_posts_status (workspace_id, status, scheduled_at),
  FULLTEXT INDEX idx_posts_caption (base_caption)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_targets (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  channel_id CHAR(36) NOT NULL,
  platform ENUM('facebook', 'instagram') NOT NULL,
  caption TEXT NULL,
  content_type ENUM('text', 'image', 'video', 'reel', 'carousel') NOT NULL DEFAULT 'text',
  status ENUM(
    'draft',
    'scheduled',
    'queued',
    'processing',
    'published',
    'failed',
    'cancelled'
  ) NOT NULL DEFAULT 'draft',
  published_at DATETIME(3) NULL,
  external_post_id VARCHAR(255) NULL,
  external_url VARCHAR(700) NULL,
  friendly_error VARCHAR(500) NULL,
  technical_error TEXT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_targets_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_targets_channel FOREIGN KEY (channel_id) REFERENCES social_channels(id),
  UNIQUE KEY uq_post_channel (post_id, channel_id),
  INDEX idx_targets_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_media (
  target_id CHAR(36) NOT NULL,
  media_id CHAR(36) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (target_id, media_id),
  CONSTRAINT fk_post_media_target FOREIGN KEY (target_id) REFERENCES post_targets(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_media_asset FOREIGN KEY (media_id) REFERENCES media_assets(id),
  INDEX idx_post_media_position (target_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS publication_jobs (
  id CHAR(36) PRIMARY KEY,
  target_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(190) NOT NULL UNIQUE,
  status ENUM('waiting', 'locked', 'retry', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'waiting',
  run_at DATETIME(3) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 4,
  locked_at DATETIME(3) NULL,
  locked_by VARCHAR(190) NULL,
  completed_at DATETIME(3) NULL,
  last_error_code VARCHAR(120) NULL,
  last_error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jobs_target FOREIGN KEY (target_id) REFERENCES post_targets(id) ON DELETE CASCADE,
  INDEX idx_jobs_claim (status, run_at, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS publication_attempts (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  target_id CHAR(36) NOT NULL,
  attempt_number INT UNSIGNED NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  result ENUM('processing', 'success', 'temporary_failure', 'permanent_failure') NOT NULL DEFAULT 'processing',
  error_code VARCHAR(120) NULL,
  friendly_error VARCHAR(500) NULL,
  technical_error TEXT NULL,
  sanitized_response JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_attempts_job FOREIGN KEY (job_id) REFERENCES publication_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_target FOREIGN KEY (target_id) REFERENCES post_targets(id) ON DELETE CASCADE,
  UNIQUE KEY uq_job_attempt (job_id, attempt_number),
  INDEX idx_attempts_target (target_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metrics (
  id CHAR(36) PRIMARY KEY,
  target_id CHAR(36) NOT NULL,
  metric_type ENUM('likes', 'comments', 'shares', 'reach', 'impressions', 'video_views') NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  collected_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_metrics_target FOREIGN KEY (target_id) REFERENCES post_targets(id) ON DELETE CASCADE,
  UNIQUE KEY uq_metric_snapshot (target_id, metric_type, collected_at),
  INDEX idx_metrics_target (target_id, metric_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  type ENUM(
    'published',
    'partially_published',
    'failed',
    'channel_disconnected',
    'token_expired',
    'permission_revoked',
    'media_rejected',
    'schedule_cancelled',
    'info'
  ) NOT NULL,
  title VARCHAR(190) NOT NULL,
  message VARCHAR(600) NOT NULL,
  related_type VARCHAR(80) NULL,
  related_id CHAR(36) NULL,
  read_at DATETIME(3) NULL,
  email_sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_notifications_unread (user_id, workspace_id, read_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id CHAR(36) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_workspace (workspace_id, created_at),
  INDEX idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
