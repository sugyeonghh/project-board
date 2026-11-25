package com.pmboard.jira;

import java.util.List;

/**
 * Jira 연동 자리 (아직 구현 안 함).
 * 프로젝트·할일 테이블의 jira_key 컬럼, 상태 값(TODO/IN_PROGRESS/BLOCKED/DONE)이 이 연동을 위해 준비돼 있다.
 *
 * 구현 순서 제안
 *  1. 설정 화면에 Jira URL·이메일·API 토큰 저장 (SettingsService.setSecret 사용)
 *  2. JiraRestClient implements IssueTrackerClient — /rest/api/3/search, /rest/api/3/issue 호출
 *  3. 주기적 동기화 스케줄러: Jira 변경분을 가져와 Task에 반영하고 ChangeLog에 "Jira" 출처로 기록
 */
public interface IssueTrackerClient {

    record RemoteIssue(String key, String summary, String status, String assigneeEmail, String dueDate) {}

    /** 프로젝트 키(예: FINPG)의 이슈 목록 */
    List<RemoteIssue> issues(String projectKey);

    /** 이슈 상태 변경 (예: In Progress → Done) */
    void transition(String issueKey, String targetStatus);
}
