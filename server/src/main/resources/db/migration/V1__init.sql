-- PM Board 초기 스키마 (MySQL 8.0 이상, InnoDB, utf8mb4)
-- 상태·분류 값은 Java enum 이름 그대로 저장한다.
-- 시간 컬럼은 DATETIME(6)이며 서버 시간대(Asia/Seoul) 기준으로 저장한다.

-- 사용자 -----------------------------------------------------------------
CREATE TABLE app_user (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    display_name    VARCHAR(50)  NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER',      -- USER, ADMIN
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 프로젝트 ---------------------------------------------------------------
CREATE TABLE project (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     VARCHAR(500),
    goal            TEXT,
    scope           TEXT,          -- 줄바꿈으로 구분한 목록
    out_of_scope    TEXT,
    done_criteria   TEXT,
    stakeholders    TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS', -- PLANNED, IN_PROGRESS, AT_RISK, BLOCKED, DONE, CANCELLED
    priority        SMALLINT     NOT NULL DEFAULT 2,             -- 1 높음, 2 보통, 3 낮음
    owner_id        BIGINT,
    start_date      DATE,
    end_date        DATE,
    closed_on       DATE,          -- 종료일 (종료된 프로젝트 연도별 보관에 사용)
    jira_key        VARCHAR(30),   -- Jira 연동 대비 (예: FINPG)
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_project_owner FOREIGN KEY (owner_id) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE INDEX idx_project_status ON project(status, priority);

-- 프로젝트 참여자: 여기에 들어 있는 사람(과 책임자)이 같은 프로젝트를 함께 관리한다
CREATE TABLE project_member (
    project_id      BIGINT NOT NULL,
    user_id         BIGINT NOT NULL,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_member_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_member_user    FOREIGN KEY (user_id)    REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE milestone (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL,
    due_date        DATE         NOT NULL,
    done            BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order      INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_milestone_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE INDEX idx_milestone_due ON milestone(due_date);

-- 할일 -------------------------------------------------------------------
CREATE TABLE task (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    summary         VARCHAR(300),  -- 목록에 보이는 한 줄 메모
    status          VARCHAR(20)  NOT NULL DEFAULT 'TODO', -- TODO, IN_PROGRESS, BLOCKED, DONE
    priority        SMALLINT     NOT NULL DEFAULT 2,
    assignee_id     BIGINT,
    start_date      DATE,
    due_date        DATE,
    blocked_reason  TEXT,
    blocked_since   DATE,
    jira_key        VARCHAR(30),   -- Jira 연동 대비 (예: FINPG-123)
    done_at         DATETIME(6),
    created_by      BIGINT,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_task_project  FOREIGN KEY (project_id)  REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignee FOREIGN KEY (assignee_id) REFERENCES app_user(id),
    CONSTRAINT fk_task_creator  FOREIGN KEY (created_by)  REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE INDEX idx_task_assignee ON task(assignee_id, status, due_date);
CREATE INDEX idx_task_due      ON task(status, due_date);

CREATE TABLE task_dependency (
    task_id         BIGINT NOT NULL,
    depends_on_id   BIGINT NOT NULL,
    PRIMARY KEY (task_id, depends_on_id),
    CONSTRAINT fk_dep_task   FOREIGN KEY (task_id)       REFERENCES task(id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_target FOREIGN KEY (depends_on_id) REFERENCES task(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE checklist_item (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id         BIGINT       NOT NULL,
    text            VARCHAR(300) NOT NULL,
    done            BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order      INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_check_task FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE task_comment (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id         BIGINT       NOT NULL,
    author_id       BIGINT       NOT NULL,
    body            TEXT         NOT NULL,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_comment_task   FOREIGN KEY (task_id)   REFERENCES task(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 지식노트 · 첨부 · 결정 로그 ---------------------------------------------
CREATE TABLE note (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            MEDIUMTEXT,    -- Markdown
    tags            VARCHAR(200),
    author_id       BIGINT,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_note_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_note_author  FOREIGN KEY (author_id)  REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE attachment (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    task_id         BIGINT,
    original_name   VARCHAR(300) NOT NULL,
    stored_path     VARCHAR(500) NOT NULL,
    size_bytes      BIGINT       NOT NULL,
    content_type    VARCHAR(100),
    uploaded_by     BIGINT,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_attach_project FOREIGN KEY (project_id)  REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_attach_task    FOREIGN KEY (task_id)     REFERENCES task(id) ON DELETE SET NULL,
    CONSTRAINT fk_attach_user    FOREIGN KEY (uploaded_by) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE decision (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT       NOT NULL,
    decided_on      DATE         NOT NULL,
    what            VARCHAR(300) NOT NULL,
    why             TEXT,
    decided_by      VARCHAR(100),
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_decision_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 운영 · 단순 업무 ---------------------------------------------------------
CREATE TABLE ops_task (
    id                    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category              VARCHAR(20)  NOT NULL,          -- REQUEST, INCIDENT, ROUTINE, SIMPLE
    title                 VARCHAR(300) NOT NULL,
    description           TEXT,
    requester             VARCHAR(100),
    assignee_id           BIGINT,
    status                VARCHAR(20)  NOT NULL DEFAULT 'OPEN', -- OPEN, DONE
    work_date             DATE         NOT NULL DEFAULT (CURRENT_DATE),
    due_date              DATE,
    spent_minutes         INT,
    converted_project_id  BIGINT,
    created_at            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    done_at               DATETIME(6),
    CONSTRAINT fk_ops_assignee FOREIGN KEY (assignee_id)          REFERENCES app_user(id),
    CONSTRAINT fk_ops_project  FOREIGN KEY (converted_project_id) REFERENCES project(id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE INDEX idx_ops_assignee ON ops_task(assignee_id, work_date);
CREATE INDEX idx_ops_date     ON ops_task(work_date);

CREATE TABLE routine (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    cycle           VARCHAR(10)  NOT NULL,   -- DAILY, WEEKLY, MONTHLY
    day_of_week     SMALLINT,                -- 1(월)~7(일), WEEKLY일 때
    day_of_month    SMALLINT,                -- 1~31, MONTHLY일 때 (말일보다 크면 말일)
    assignee_id     BIGINT,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    last_done_on    DATE,
    CONSTRAINT fk_routine_assignee FOREIGN KEY (assignee_id) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 메모장 (본인만 보는 개인 메모) ----------------------------------------------
CREATE TABLE memo (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id        BIGINT       NOT NULL,
    body            TEXT         NOT NULL,
    tag             VARCHAR(30),
    pinned          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_memo_owner FOREIGN KEY (owner_id) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 변경 이력 (자동 기록) -----------------------------------------------------
CREATE TABLE change_log (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT,                  -- 프로젝트 밖 변경이면 NULL
    entity_type     VARCHAR(20)  NOT NULL,   -- PROJECT, TASK, MILESTONE
    entity_id       BIGINT       NOT NULL,
    entity_label    VARCHAR(300),            -- 기록 당시 이름 (나중에 이름이 바뀌어도 이력은 그대로)
    field           VARCHAR(50)  NOT NULL,   -- status, dueDate, assignee ...
    kind            VARCHAR(20)  NOT NULL,   -- STATUS, SCHEDULE, ASSIGNEE, CONTENT, CREATE
    old_value       TEXT,
    new_value       TEXT,
    changed_by      BIGINT,
    changed_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_change_user FOREIGN KEY (changed_by) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
CREATE INDEX idx_change_project ON change_log(project_id, changed_at);
CREATE INDEX idx_change_entity  ON change_log(entity_type, entity_id);
CREATE INDEX idx_change_user    ON change_log(changed_by, changed_at);

-- 보고서 (일일 업무 일지 / 주간보고) ------------------------------------------
CREATE TABLE report (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id        BIGINT       NOT NULL,
    type            VARCHAR(10)  NOT NULL,   -- DAILY, WEEKLY
    period_start    DATE         NOT NULL,
    period_end      DATE         NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         MEDIUMTEXT   NOT NULL,   -- Markdown
    method          VARCHAR(10)  NOT NULL,   -- BASIC, AI
    status          VARCHAR(10)  NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_report_period (owner_id, type, period_start),
    CONSTRAINT fk_report_owner FOREIGN KEY (owner_id) REFERENCES app_user(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 설정 (AI 키 등은 암호화해서 저장) ------------------------------------------
CREATE TABLE app_setting (
    setting_key     VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value   TEXT,
    encrypted       BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

INSERT INTO app_setting (setting_key, setting_value) VALUES
    ('ai.provider',        'CLAUDE'),
    ('ai.model',           ''),
    ('report.daily.time',  '18:00'),
    ('report.weekly.day',  '5'),      -- 1(월)~7(일)
    ('report.weekly.time', '16:00'),
    ('report.style',       'BULLET'), -- BULLET(개조식), POLITE(존댓말)
    ('report.after',       'DRAFT'),  -- DRAFT(초안으로 두기), PUBLISH(바로 게시)
    ('report.guide',       '프로젝트별로 묶어서 작성한다.\n각 항목은 [프로젝트명] 다음에 한 줄로 쓴다.\n막힌 일은 누구의 도움이 필요한지 함께 적는다.\n맨 위에 3문장 이내 요약을 넣는다.');
