// Issue and store types for ideae

export interface FileRef {
  path: string
  /** Optional line range, e.g. 10-25 */
  lines?: { start: number; end?: number }
}

export type IssueStatus = "open" | "closed"
export type IssuePriority = "low" | "medium" | "high"

export interface Issue {
  id: string
  title: string
  body: string
  status: IssueStatus
  priority: IssuePriority
  labels: string[]
  files: FileRef[]
  /** Remote issue number after push */
  remoteNumber?: number
  /** "github" | "gitlab" */
  provider?: "github" | "gitlab"
  createdAt: string
  updatedAt: string
}

export type ProviderType = "github" | "gitlab"

export interface CommandResult {
  stdout: string
  stderr: string
  code: number
}

export interface Comment {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface GitProvider {
  type: ProviderType
  repo: string
  cli: "gh" | "glab"
  /** Execute any CLI command and return raw result */
  execute(args: string[]): Promise<CommandResult>
  /** Create an issue */
  createIssue(title: string, body: string, labels: string[]): Promise<number>
  /** Close an issue by number */
  closeIssue(number: number): Promise<void>
  /** Reopen an issue by number */
  reopenIssue(number: number): Promise<void>
  /** List all issues */
  listIssues(): Promise<Issue[]>
  /** Get comments for an issue */
  getIssueComments(number: number): Promise<Comment[]>
}

export interface IssueStore {
  issues: Issue[]
  add(issue: Issue): void
  update(id: string, patch: Partial<Issue>): void
  remove(id: string): void
  get(id: string): Issue | undefined
  save(): Promise<void>
  load(): Promise<void>
}

// Agent types for GitHub Copilot agent tasks
export type AgentTaskStatus = "draft" | "in_progress" | "completed" | "failed"

export interface AgentTask {
  id: string // session ID
  title: string // task description
  pullRequestNumber?: number
  repository: string
  status: AgentTaskStatus
  createdAt: string
  updatedAt?: string
}

export interface AgentTaskStore {
  tasks: AgentTask[]
  add(task: AgentTask): void
  update(id: string, patch: Partial<AgentTask>): void
  remove(id: string): void
  get(id: string): AgentTask | undefined
  getByPR(prNumber: number): AgentTask[]
  save(): Promise<void>
  load(): Promise<void>
}
