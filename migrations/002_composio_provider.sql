ALTER TABLE social_channels
  ADD COLUMN connection_provider ENUM('direct', 'composio', 'demo')
    NOT NULL DEFAULT 'direct' AFTER account_type,
  ADD COLUMN provider_connection_id VARCHAR(190) NULL AFTER connection_provider,
  ADD COLUMN provider_toolkit VARCHAR(80) NULL AFTER provider_connection_id,
  ADD INDEX idx_channels_provider (
    workspace_id,
    connection_provider,
    provider_connection_id
  );

UPDATE social_channels
SET connection_provider = 'demo',
    provider_toolkit = platform
WHERE is_demo = TRUE;

CREATE TABLE IF NOT EXISTS provider_connection_requests (
  id CHAR(36) PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  provider ENUM('composio') NOT NULL,
  platform ENUM('facebook', 'instagram') NOT NULL,
  state_hash CHAR(64) NOT NULL UNIQUE,
  provider_user_id VARCHAR(256) NOT NULL,
  provider_connection_id VARCHAR(190) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_provider_request_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_provider_request_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_provider_request_lookup (
    workspace_id,
    user_id,
    provider,
    expires_at
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
