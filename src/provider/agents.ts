import type { AgentTask, ProviderType } from "../types.ts"

/**
 * Agent task management for GitHub Copilot
 * Uses gh CLI agent-task commands to create and manage autonomous coding agents
 */

export interface AgentTaskProvider {
  type: ProviderType
  repo: string
  /** List all agent tasks */
  listAgentTasks(limit?: number): Promise<AgentTask[]>
  /** Create a new agent task */
  createAgentTask(description: string, issueNumber?: number): Promise<AgentTask>
  /** View agent task details and logs */
  viewAgentTask(sessionId: string): Promise<string>
  /** Follow agent task logs in real-time */
  followAgentTask(sessionId: string): Promise<void>
}

/**
 * Create an agent task provider for GitHub
 */
export function createAgentTaskProvider(
  type: ProviderType,
  repo: string
): AgentTaskProvider {
  if (type === "github") {
    return createGitHubAgentTaskProvider(repo)
  }
  // GitLab doesn't have agent tasks yet
  throw new Error("Agent tasks are only supported on GitHub")
}

// ---------------------------------------------------------------------------
// GitHub agent task provider using `gh agent-task` CLI
// ---------------------------------------------------------------------------

function createGitHubAgentTaskProvider(repo: string): AgentTaskProvider {
  return {
    type: "github",
    repo,

    async listAgentTasks(limit = 30): Promise<AgentTask[]> {
      try {
        const proc = Bun.spawn(
          ["gh", "agent-task", "list", "--limit", String(limit), "--repo", repo],
          { stdout: "pipe", stderr: "pipe" }
        )

        const out = await new Response(proc.stdout).text()
        const code = await proc.exited

        if (code !== 0) {
          console.error("Failed to list agent tasks")
          return []
        }

        // Parse the output (format: "Description\t#PR\tRepo\tStatus\tDate")
        const lines = out.trim().split("\n")
        const tasks: AgentTask[] = []

        for (const line of lines) {
          if (!line.trim()) continue

          // Example line: "Fixing download button functionality on plans page\t#3\tofrades/schola\tReady for review\t2026-02-14T10:14:01Z"
          const match = line.match(/^(.+?)\t#(\d+)\t(.+?)\t(.+?)\t(.+)$/)
          if (match) {
            const [, title, prNumber, repository, status, createdAt] = match
            
            // Map GitHub status to our status
            let taskStatus: AgentTask["status"] = "in_progress"
            if (status?.includes("Ready for review") || status?.includes("Merged")) {
              taskStatus = "completed"
            } else if (status?.includes("Draft")) {
              taskStatus = "draft"
            } else if (status?.includes("Closed") || status?.includes("Failed")) {
              taskStatus = "failed"
            }

            tasks.push({
              id: `pr-${prNumber}`, // We'll use PR number as ID for now
              title: title || "Untitled task",
              pullRequestNumber: parseInt(prNumber || "0", 10),
              repository: repository || repo,
              status: taskStatus,
              createdAt: createdAt || new Date().toISOString(),
            })
          }
        }

        return tasks
      } catch (error) {
        console.error("Error listing agent tasks:", error)
        return []
      }
    },

    async createAgentTask(description: string, issueNumber?: number): Promise<AgentTask> {
      try {
        // Build task description with optional issue reference
        let taskDesc = description
        if (issueNumber) {
          taskDesc = `${description}\n\nRelated issue: #${issueNumber}`
        }

        const proc = Bun.spawn(
          [
            "gh",
            "agent-task",
            "create",
            taskDesc,
            "--repo",
            repo,
          ],
          { stdout: "pipe", stderr: "pipe" }
        )

        const out = await new Response(proc.stdout).text()
        const err = await new Response(proc.stderr).text()
        const code = await proc.exited

        if (code !== 0) {
          throw new Error(`Failed to create agent task: ${err}`)
        }

        // Extract PR number and session ID from output
        // Output format: "Created agent task: https://github.com/OWNER/REPO/pull/123/agent-sessions/abc-123"
        const prMatch = out.match(/pull\/(\d+)/)
        const prNumber = prMatch?.[1] ? parseInt(prMatch[1], 10) : undefined
        
        const sessionMatch = out.match(/agent-sessions\/([a-zA-Z0-9-]+)/)
        const sessionId = sessionMatch?.[1] || `pr-${prNumber || Date.now()}`

        return {
          id: sessionId,
          title: description,
          pullRequestNumber: prNumber,
          repository: repo,
          status: "in_progress",
          createdAt: new Date().toISOString(),
        }
      } catch (error) {
        console.error("Error creating agent task:", error)
        throw error
      }
    },

    async viewAgentTask(sessionId: string): Promise<string> {
      try {
        const proc = Bun.spawn(
          ["gh", "agent-task", "view", sessionId, "--repo", repo, "--log"],
          { stdout: "pipe", stderr: "pipe" }
        )

        const out = await new Response(proc.stdout).text()
        const code = await proc.exited

        if (code !== 0) {
          throw new Error("Failed to view agent task")
        }

        return out
      } catch (error) {
        console.error("Error viewing agent task:", error)
        return `Error: ${error}`
      }
    },

    async followAgentTask(sessionId: string): Promise<void> {
      try {
        // This would open a streaming connection, but for TUI we'll just view once
        await this.viewAgentTask(sessionId)
      } catch (error) {
        console.error("Error following agent task:", error)
      }
    },
  }
}
