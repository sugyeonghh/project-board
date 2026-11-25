-- 마일스톤을 기간(시작일~종료일)으로도 쓸 수 있게 시작일 추가. 비어 있으면 기존처럼 하루짜리(due_date) 마일스톤.
ALTER TABLE milestone ADD COLUMN start_date DATE NULL AFTER name;
