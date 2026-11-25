// 서버 DTO(server/.../web/dto/Dtos.java)와 1:1로 맞춘 타입

export type ProjectStatus = "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type OpsCategory = "REQUEST" | "INCIDENT" | "ROUTINE" | "SIMPLE";
export type OpsStatus = "OPEN" | "DONE";
export type RoutineCycle = "DAILY" | "WEEKLY" | "MONTHLY";
export type ReportType = "DAILY" | "WEEKLY";
export type ReportStatus = "DRAFT" | "PUBLISHED";
export type ChangeKind = "STATUS" | "SCHEDULE" | "ASSIGNEE" | "CONTENT" | "CREATE";

export interface UserRef { id: number; name: string }
export interface UserInfo { id: number; username: string; displayName: string; role: "USER" | "ADMIN" }
export interface LoginResponse { token: string; user: UserInfo }

export interface ProjectSummary {
  id: number; name: string; description: string | null; status: ProjectStatus; priority: number;
  progress: number; doneCount: number; totalCount: number; owner: UserRef | null; memberCount: number;
  startDate: string | null; endDate: string | null; closedOn: string | null; nextStep: string | null;
}

export interface ProjectDetail {
  id: number; name: string; description: string | null; goal: string | null; scope: string | null;
  outOfScope: string | null; doneCriteria: string | null; stakeholders: string | null;
  status: ProjectStatus; priority: number; owner: UserRef | null; members: UserRef[];
  startDate: string | null; endDate: string | null; closedOn: string | null; jiraKey: string | null;
  progress: number; doneCount: number; totalCount: number;
}

export interface ProjectRequest {
  name?: string; description?: string; goal?: string; scope?: string; outOfScope?: string;
  doneCriteria?: string; stakeholders?: string; status?: ProjectStatus; priority?: number;
  ownerId?: number; memberIds?: number[]; startDate?: string; endDate?: string; jiraKey?: string;
}

export interface Milestone { id: number; name: string; startDate: string | null; dueDate: string; done: boolean; sortOrder: number }
export interface Decision { id: number; decidedOn: string; what: string; why: string | null; decidedBy: string | null }

export interface TaskRef { id: number; title: string; status: TaskStatus }
export interface Task {
  id: number; projectId: number; projectName: string; title: string; summary: string | null;
  description: string | null; status: TaskStatus; priority: number; assignee: UserRef | null;
  startDate: string | null; dueDate: string | null; blockedReason: string | null; blockedSince: string | null;
  jiraKey: string | null; doneAt: string | null; dependsOn: TaskRef[];
}
export interface TaskRequest {
  title?: string; summary?: string; description?: string; status?: TaskStatus; priority?: number;
  assigneeId?: number; startDate?: string; dueDate?: string; blockedReason?: string; jiraKey?: string;
  dependsOnIds?: number[];
}
export interface ChecklistItem { id: number; text: string; done: boolean; sortOrder: number }
export interface Comment { id: number; author: UserRef; body: string; createdAt: string; updatedAt: string | null }
export interface Attachment {
  id: number; projectId: number; taskId: number | null; taskTitle: string | null; name: string;
  sizeBytes: number; contentType: string | null; uploadedBy: UserRef | null; createdAt: string;
}
export interface Change {
  id: number; projectId: number | null; entityType: string; entityId: number; entityLabel: string | null;
  field: string; kind: ChangeKind; oldValue: string | null; newValue: string | null;
  changedBy: UserRef | null; changedAt: string;
}
export interface TaskDetail {
  task: Task; checklist: ChecklistItem[]; comments: Comment[]; attachments: Attachment[];
  history: Change[]; dependents: TaskRef[];
}
export interface Note {
  id: number; projectId: number; title: string; body: string | null; tags: string | null;
  author: UserRef | null; updatedAt: string;
}

export interface MyTaskItem {
  source: "TASK" | "OPS" | "ROUTINE"; id: number; title: string; projectId: number | null;
  projectName: string; status: string; dueDate: string | null; group: "late" | "today" | "week" | "later" | "done";
  /** 완료 목록에서만: 완료한 날 */
  doneOn: string | null;
}
export interface Ops {
  id: number; category: OpsCategory; title: string;
  /** 요청 내용 */ description: string | null;
  /** 처리 내역 */ resolution: string | null;
  requester: string | null;
  assignee: UserRef | null; status: OpsStatus; workDate: string; dueDate: string | null;
  spentMinutes: number | null; convertedProjectId: number | null; createdAt: string; doneAt: string | null;
}
export interface Routine {
  id: number; name: string; cycle: RoutineCycle; dayOfWeek: number | null; dayOfMonth: number | null;
  assignee: UserRef | null; nextDue: string; done: boolean;
}
export interface Memo { id: number; body: string; tag: string | null; pinned: boolean; createdAt: string; updatedAt: string }

export interface BlockedItem { task: Task; days: number }
export interface YearGroup { year: number; projects: ProjectSummary[] }
export interface Dashboard {
  activeCount: number; dueThisWeek: number; atRiskCount: number; blockedCount: number;
  active: ProjectSummary[]; dueTasks: Task[]; blocked: BlockedItem[]; closedByYear: YearGroup[];
}
export interface CalendarEvent {
  type: "TASK" | "MILESTONE" | "OPS" | "PROJECT" | "PROJECT_START" | "PROJECT_END"; id: number; title: string; date: string;
  /** 있으면 date~endDate 기간 일정 */
  endDate: string | null;
  projectId: number | null; projectName: string;
}
export interface SearchResult {
  type: "PROJECT" | "TASK" | "NOTE" | "ATTACHMENT" | "COMMENT" | "MEMO" | "OPS" | "CHANGE";
  id: number; title: string; context: string; projectId: number | null;
}
export interface Report {
  id: number; type: ReportType; periodStart: string; periodEnd: string; title: string; content: string;
  method: "BASIC" | "AI"; status: ReportStatus; createdAt: string; updatedAt: string;
}
export interface AiSettings { provider: string; model: string; hasKey: boolean; secretKeyReady: boolean }
export interface ReportSettings {
  dailyTime: string; weeklyDay: number; weeklyTime: string; style: string; after: string; guide: string;
}
