# 구조 설명

## 1. 전체 구성

| 층 | 기술 | 하는 일 |
|---|---|---|
| 윈도우 앱 | Tauri 2 + React 18 + TypeScript + Vite | 화면. 서버 API만 호출하고 데이터는 PC에 두지 않음 (서버 주소·로그인 토큰만 저장) |
| 서버 | Spring Boot 3.4 / Java 21 | 로그인(JWT), 권한, 변경 이력 자동 기록, 보고서 생성·스케줄, AI 호출, 첨부파일 저장 |
| DB | MySQL 8.0 (utf8mb4) | 모든 업무 데이터. 스키마는 Flyway로 관리 |
| 파일 | 서버 디스크 (`PMBOARD_STORAGE_DIR`) | 첨부파일 원본. DB에는 경로만 |

AI 키는 서버에만 있습니다. 앱은 AI를 직접 부르지 않고 서버에 "보고서 만들어 줘"라고만 요청하므로, 키가 팀원 PC로 나가지 않습니다.

## 2. 코드 위치

```
server/src/main/java/com/pmboard/
  config/   보안(JWT, CORS), 암호화(CryptoService), 예외 처리, 첫 관리자 생성
  domain/   JPA 엔티티와 상태 enum
  repo/     Spring Data 저장소
  service/  업무 로직
    ProjectService      프로젝트·마일스톤·결정 로그, 수정 권한(editable)
    TaskService         할일·체크리스트·코멘트
    ChangeLogService    변경 이력 자동 기록 (값이 바뀐 필드만 한 줄씩)
    MyTaskService       내 할일 모아보기 (할일 + 운영업무 + 정기 작업)
    OpsService          운영업무·정기 작업·프로젝트 전환
    SearchService       통합 검색 (UNION 쿼리)
    ReportDataCollector 보고서 재료 모으기
    ReportService       일일 일지·주간보고 작성 (기본 / AI)
    ReportScheduler     설정 시각에 전원 보고서 자동 생성 (1분마다 확인)
    SettingsService     설정값, AI 키 암호화 저장
  ai/       AI 제공사 연결 (Claude, OpenAI). 새 제공사는 AiClient 구현 후 Bean 등록
  jira/     Jira 연동 인터페이스 (아직 구현 안 함)
  web/      REST 컨트롤러, dto/Dtos.java (요청·응답 모델 모음)

desktop/src/
  api/        client.ts (서버 호출), types.ts (서버 DTO와 같은 타입)
  components/ Layout(상단바·사이드바), TaskModal(할일 팝업), ScheduleStrip(일정 막대)
  pages/      화면별 파일 (시안의 화면과 1:1)
  lib/        인증, 날짜·라벨 변환, Markdown 표시, 파일 저장
desktop/src-tauri/  창 크기, 설치 파일 설정, 권한(capabilities)
```

## 3. 시안 화면 ↔ 코드

| 시안 화면 | 앱 경로 | 파일 | 주요 API |
|---|---|---|---|
| 대시보드 | `/` | DashboardPage | `GET /api/dashboard`, `PATCH /api/projects/{id}/priority` |
| 종료된 프로젝트 | `/archive` | ArchivePage | `GET /api/projects/archive` |
| 프로젝트 상세 | `/projects/:id` | ProjectPage | `GET /api/projects/{id}`, `/tasks`, `/milestones`, `/notes`, `/attachments`, `/decisions`, `/history`, `DELETE /api/projects/{id}` (책임자·관리자) |
| 할일 상세 팝업 | `/projects/:id?task=` | TaskModal | `GET/PUT /api/tasks/{id}`, 체크리스트·코멘트 |
| 내 할일 | `/my` | MyTasksPage | `GET /api/my-tasks`, `?done=true` (완료한 항목) |
| 운영업무 | `/ops` | OpsPage | `/api/ops`, `GET/PUT/DELETE /api/ops/{id}` (상세 창: `/ops?open={id}`), `/api/routines` |
| 보고서 (+모아보기) | `/reports` | ReportsPage | `POST /api/reports/generate`, `GET /api/reports?month=` |
| 메모장 | `/memos` | MemosPage | `/api/memos` |
| 캘린더 | `/calendar` | CalendarPage | `GET /api/calendar?from&to&mine` (mine=true: 내가 책임자·참여자인 프로젝트만, 프로젝트 시작·종료일 포함) |
| 통합 검색 | `/search?q=` | SearchPage | `GET /api/search?q=` |
| 설정 | `/settings` | SettingsPage | `/api/settings/ai`, `/api/settings/report`, `POST /api/users` |

## 4. DB 테이블

| 테이블 | 내용 | 비고 |
|---|---|---|
| app_user | 계정 | role: USER / ADMIN |
| project | 프로젝트 | priority 1~3, closed_on(종료 연도), jira_key |
| project_member | 참여자 | 참여자(책임자 포함)만 수정 가능, 삭제는 책임자·관리자 |
| milestone | 마일스톤 | start_date가 있으면 기간(시작~due_date), 없으면 하루짜리 (V2) |
| task | 할일 | status, assignee, start/due, blocked_reason·blocked_since, jira_key |
| task_dependency | 선행·후행 할일 | |
| checklist_item, task_comment | 할일 세부 체크리스트, 코멘트 | 코멘트는 참여자만 작성, 수정·삭제는 쓴 사람만 (`PUT/DELETE /api/comments/{id}`), updated_at (V3) |
| note | 프로젝트 지식노트 (Markdown) | |
| attachment | 첨부파일 정보 | task_id가 있으면 그 할일에 연결 |
| decision | 결정 로그 | |
| ops_task | 운영·단순 업무 | category: REQUEST / INCIDENT / ROUTINE / SIMPLE, description=요청 내용, resolution=처리 내역 (V4) |
| routine | 정기 작업 | DAILY / WEEKLY / MONTHLY, last_done_on |
| memo | 개인 메모장 | 본인만 |
| change_log | 변경 이력 | entity_label에 당시 이름을 남겨 이름이 바뀌어도 이력 유지 |
| report | 일일 일지·주간보고 | (owner, type, period_start) 하나만, 다시 만들면 덮어씀(게시된 건 보호) |
| app_setting | 설정 | encrypted=1이면 AES-GCM 암호문 (AI 키) |

## 5. 변경 이력이 기록되는 방식

서비스의 수정 메서드가 바꾸기 전 값을 잡아 두고, 바꾼 뒤 `ChangeLogService.on(...).diff(필드, 종류, 전, 후)`를 부릅니다. 값이 같으면 기록하지 않습니다. 새 필드를 이력에 넣고 싶으면 해당 서비스의 `update`에 `diff` 한 줄을 추가하면 됩니다.

기록 대상: 프로젝트(상태·일정·책임자·우선순위·목표·범위), 할일(상태·담당자·시작·마감·제목·우선순위), 마일스톤(날짜·완료·이름), 그리고 생성.

## 6. 보고서 자동 작성 흐름

1. `ReportDataCollector`가 기간 안의 재료를 모읍니다: 완료한 할일(done_at), 진행 중 할일, 운영업무, 내가 바꾼 변경 이력, 막힌 일, 다음 기간 마감 할일
2. 화면에서 고른 섹션만 남깁니다
3. 기본 초안: Markdown 양식으로 정리합니다
4. AI 작성: 기본 초안 + 설정의 "작성 지침"·문체를 AI에 보내 다듬습니다 (재료에 없는 내용은 쓰지 말라고 지시)
5. 자동 생성: `ReportScheduler`가 평일 설정 시각에 일일 일지, 설정 요일·시각에 주간보고를 모든 사용자 몫으로 만듭니다. AI 호출이 실패하면 기본 초안으로 대신합니다

## 7. 다음 개발 순서 제안

1. **서버 첫 실행 확인**: `gradlew bootRun` → 로그인 → 프로젝트·할일 만들기까지 한 바퀴
2. **테스트 데이터**: 실제 진행 중인 프로젝트 2~3개를 넣어 보고 화면 다듬기
3. **알림**: 막힌 지 N일, 마감 지남 알림 (Tauri notification 플러그인)
4. **할일 드래그 정렬·일괄 수정**
5. **Confluence 게시**: 보고서 화면의 "게시" 버튼 → Confluence REST API (기존 주간보고 자동화 코드 재사용)
6. **Jira 연동**: `jira/IssueTrackerClient` 구현 → 설정에 URL·토큰 저장 → 상태 동기화 스케줄러. 상태 대응표: TODO↔To Do, IN_PROGRESS↔In Progress, BLOCKED↔Blocked, DONE↔Done
7. **앱 자동 업데이트**: Tauri updater 플러그인 + 사내 파일 서버
