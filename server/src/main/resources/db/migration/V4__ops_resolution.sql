-- 운영업무 처리 내역 (요청 내용은 기존 description)
ALTER TABLE ops_task ADD COLUMN resolution TEXT NULL AFTER description;
