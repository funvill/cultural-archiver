-- Migration 0025: User Profiles & Badges System
-- Date: 2025-09-21
-- Issue: Add profile names and badge system for authenticated users with verified emails
-- MVP Focus: Activity badges only with real-time calculation

-- Step 1: Add profile_name column to existing users table
ALTER TABLE users ADD COLUMN profile_name TEXT CHECK (
  profile_name IS NULL OR (
    length(profile_name) >= 3 AND 
    length(profile_name) <= 20 AND
    profile_name GLOB '[a-zA-Z0-9]*' AND
    profile_name NOT GLOB '-*' AND
    profile_name NOT GLOB '*-'
  )
);

-- Step 2: Create badges definition table
CREATE TABLE badges (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  badge_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('activity', 'community', 'seasonal', 'geographic')),
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('submission_count', 'photo_count', 'account_age', 'email_verified')),
  threshold_value INTEGER,
  level INTEGER DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 3: Create user_badges awards table
CREATE TABLE user_badges (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 36 AND 
    id LIKE '________-____-____-____-____________' AND
    substr(id, 15, 1) IN ('1','2','3','4','5') AND
    substr(id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  user_uuid TEXT NOT NULL CHECK (
    length(user_uuid) = 36 AND 
    user_uuid LIKE '________-____-____-____-____________' AND
    substr(user_uuid, 15, 1) IN ('1','2','3','4','5') AND
    substr(user_uuid, 20, 1) IN ('8','9','a','b','A','B')
  ),
  badge_id TEXT NOT NULL CHECK (
    length(badge_id) = 36 AND 
    badge_id LIKE '________-____-____-____-____________' AND
    substr(badge_id, 15, 1) IN ('1','2','3','4','5') AND
    substr(badge_id, 20, 1) IN ('8','9','a','b','A','B')
  ),
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  award_reason TEXT NOT NULL,
  metadata TEXT, -- JSON for additional badge-specific data
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE(user_uuid, badge_id) -- Each user can only earn each badge once
);

-- Step 4: Create indexes for performance
CREATE UNIQUE INDEX idx_users_profile_name_unique ON users(profile_name) WHERE profile_name IS NOT NULL;
CREATE INDEX idx_badges_category ON badges(category, is_active);
CREATE INDEX idx_badges_threshold ON badges(threshold_type, threshold_value, is_active);
CREATE INDEX idx_user_badges_user ON user_badges(user_uuid, awarded_at);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id, awarded_at);

-- Step 5: Insert initial badge definitions for MVP
INSERT INTO badges (id, badge_key, title, description, icon_emoji, category, threshold_type, threshold_value, level) VALUES 
  -- Email Verification Badge
  ('27d8022c-41ee-4cee-b7fb-b2b5c708679e', 'email_verified', 'Email Verified', 'Completed email verification', '✅', 'activity', 'email_verified', NULL, 1),
  
  -- Submission Count Badges
  ('f4069b13-de20-46ea-be95-98e77ed85e3b', 'submission_1', 'First Discovery', 'Made your first artwork submission', '🎯', 'activity', 'submission_count', 1, 1),
  ('e5e45ff7-0ac4-400d-87ae-78f3bb647f98', 'submission_5', 'Explorer', 'Made 5 artwork submissions', '🗺️', 'activity', 'submission_count', 5, 2),
  ('03dd02df-255a-441b-9541-bcfdadbd1f04', 'submission_15', 'Discoverer', 'Made 15 artwork submissions', '🔍', 'activity', 'submission_count', 15, 3),
  ('a19bc1ff-16f3-4516-a055-c31eb01e59c7', 'submission_50', 'Master Explorer', 'Made 50 artwork submissions', '🏆', 'activity', 'submission_count', 50, 4),
  
  -- Photo Count Badges  
  ('99973fc0-93bc-4340-ada6-b35254881531', 'photo_1', 'First Photo', 'Uploaded your first photo', '📸', 'activity', 'photo_count', 1, 1),
  ('4f32ab05-ac22-4e97-8655-919197ca33e1', 'photo_10', 'Photographer', 'Uploaded 10 photos', '📷', 'activity', 'photo_count', 10, 2),
  ('e4544b3f-aac6-4827-8b26-2f87b755097b', 'photo_25', 'Photo Chronicler', 'Uploaded 25 photos', '🎨', 'activity', 'photo_count', 25, 3),
  ('e2e93251-f738-41f1-9205-6fceb3295c79', 'photo_100', 'Visual Archivist', 'Uploaded 100 photos', '🌟', 'activity', 'photo_count', 100, 4),
  
  -- Account Age Badge (30 days)
  ('a6004e43-48ec-4d1e-8fb6-84ed0161f449', 'early_adopter', 'Early Adopter', 'Member for 30 days', '🌱', 'community', 'account_age', 30, 1);