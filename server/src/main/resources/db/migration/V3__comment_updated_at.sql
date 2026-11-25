-- 코멘트 수정 시각 (수정한 적 없으면 NULL)
ALTER TABLE task_comment ADD COLUMN updated_at DATETIME(6) NULL AFTER created_at;
