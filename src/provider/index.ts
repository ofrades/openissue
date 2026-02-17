import type { GitProvider, Issue, CommandResult, Comment } from "../types.ts"

/**
 * Detect the git remote and determine if it's GitHub or GitLab.
 * Returns { type, repo } or null.
 */
export async function detectProvider(): Promise<{ type: "github" | "gitlab"; repo: string } | null> {
  try {
    const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const url = (await new Response(proc.stdout).text()).trim()
    await proc.exited

    if (!url) return null

    // Parse SSH or HTTPS URLs
    let match = url.match(/github\.com[:/](.+?)(?:\.git)?$/)
    if (match?.[1]) return { type: "github", repo: match[1] }

    match = url.match(/gitlab\.com[:/](.+?)(?:\.git)?$/)
    if (match?.[1]) return { type: "gitlab", repo: match[1] }

    return null
  } catch {
    return null
  }
}

export function createProvider(type: "github" | "gitlab", repo: string): GitProvider {
  if (type === "github") return createGitHubProvider(repo)
  return createGitLabProvider(repo)
}

// ---------------------------------------------------------------------------
// GitHub provider using `gh` CLI
// ---------------------------------------------------------------------------

function createGitHubProvider(repo: string): GitProvider {
  const baseArgs = ["--repo", repo]

  async function run(args: string[]): Promise<CommandResult> {
    const proc = Bun.spawn(["gh", ...args, ...baseArgs], { 
      stdout: "pipe", 
      stderr: "pipe" 
    })
    const out = await new Response(proc.stdout).text()
    const err = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: out, stderr: err, code }
  }

  return {
    type: "github",
    repo,
    cli: "gh",

    async execute(args: string[]): Promise<CommandResult> {
      return run(args)
    },

    async createIssue(title: string, body: string, labels: string[]): Promise<number> {
      const args = ["issue", "create", "--title", title, "--body", body]
      for (const label of labels) {
        args.push("--label", label)
      }
      
      const result = await run(args)
      if (result.code !== 0) {
        throw new Error(`gh issue create failed: ${result.stderr}`)
      }

      // gh outputs the issue URL, extract number from it
      const num = result.stdout.match(/\/issues\/(\d+)/)
      return num?.[1] ? parseInt(num[1], 10) : 0
    },

    async closeIssue(number: number): Promise<void> {
      const result = await run(["issue", "close", String(number)])
      if (result.code !== 0) {
        throw new Error(`gh issue close failed: ${result.stderr}`)
      }
    },

    async reopenIssue(number: number): Promise<void> {
      const result = await run(["issue", "reopen", String(number)])
      if (result.code !== 0) {
        throw new Error(`gh issue reopen failed: ${result.stderr}`)
      }
    },

    async listIssues(): Promise<Issue[]> {
      const result = await run([
        "issue", "list",
        "--json", "number,title,body,state,labels,createdAt,updatedAt",
        "--limit", "50",
      ])

      if (result.code !== 0) return []

      try {
        const items = JSON.parse(result.stdout) as Array<{
          number: number
          title: string
          body: string
          state: string
          labels: Array<{ name: string }>
          createdAt: string
          updatedAt: string
        }>

        return items.map((item) => ({
          id: `gh-${item.number}`,
          title: item.title,
          body: item.body || "",
          status: item.state === "OPEN" ? "open" as const : "closed" as const,
          priority: "medium" as const,
          labels: item.labels.map((l) => l.name),
          files: [],
          remoteNumber: item.number,
          provider: "github" as const,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }))
      } catch {
        return []
      }
    },

    async getIssueComments(number: number): Promise<Comment[]> {
      const result = await run([
        "issue", "view", String(number),
        "--json", "comments",
      ])

      if (result.code !== 0) return []

      try {
        const data = JSON.parse(result.stdout) as {
          comments: Array<{
            id: string
            author: { login: string }
            body: string
            createdAt: string
          }>
        }

        return data.comments.map((c) => ({
          id: c.id,
          author: c.author.login,
          body: c.body,
          createdAt: c.createdAt,
        }))
      } catch {
        return []
      }
    },
  }
}

// ---------------------------------------------------------------------------
// GitLab provider using `glab` CLI
// ---------------------------------------------------------------------------

function createGitLabProvider(repo: string): GitProvider {
  const baseArgs = ["--repo", repo]

  async function run(args: string[]): Promise<CommandResult> {
    const proc = Bun.spawn(["glab", ...args, ...baseArgs], { 
      stdout: "pipe", 
      stderr: "pipe" 
    })
    const out = await new Response(proc.stdout).text()
    const err = await new Response(proc.stderr).text()
    const code = await proc.exited
    return { stdout: out, stderr: err, code }
  }

  return {
    type: "gitlab",
    repo,
    cli: "glab",

    async execute(args: string[]): Promise<CommandResult> {
      return run(args)
    },

    async createIssue(title: string, body: string, labels: string[]): Promise<number> {
      const args = ["issue", "create", "--title", title, "--description", body]
      for (const label of labels) {
        args.push("--label", label)
      }
      
      const result = await run(args)
      if (result.code !== 0) {
        throw new Error(`glab issue create failed: ${result.stderr}`)
      }

      const num = result.stdout.match(/\/issues\/(\d+)/)
      return num?.[1] ? parseInt(num[1], 10) : 0
    },

    async closeIssue(number: number): Promise<void> {
      const result = await run(["issue", "close", String(number)])
      if (result.code !== 0) {
        throw new Error(`glab issue close failed: ${result.stderr}`)
      }
    },

    async reopenIssue(number: number): Promise<void> {
      const result = await run(["issue", "reopen", String(number)])
      if (result.code !== 0) {
        throw new Error(`glab issue reopen failed: ${result.stderr}`)
      }
    },

    async listIssues(): Promise<Issue[]> {
      const result = await run([
        "issue", "list",
        "--output", "json",
        "--per-page", "50",
      ])
      
      if (result.code !== 0) return []

      try {
        const items = JSON.parse(result.stdout) as Array<{
          iid: number
          title: string
          description: string
          state: string
          labels: string[]
          created_at: string
          updated_at: string
        }>

        return items.map((item) => ({
          id: `gl-${item.iid}`,
          title: item.title,
          body: item.description || "",
          status: item.state === "opened" ? "open" as const : "closed" as const,
          priority: "medium" as const,
          labels: item.labels || [],
          files: [],
          remoteNumber: item.iid,
          provider: "gitlab" as const,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }))
      } catch {
        return []
      }
    },

    async getIssueComments(number: number): Promise<Comment[]> {
      // glab doesn't have a direct JSON output for comments, so we use the API
      const result = await run([
        "api", `/projects/:id/issues/${number}/notes`,
        "--method", "GET",
      ])

      if (result.code !== 0) return []

      try {
        const items = JSON.parse(result.stdout) as Array<{
          id: number
          author: { username: string }
          body: string
          created_at: string
        }>

        return items.map((c) => ({
          id: String(c.id),
          author: c.author.username,
          body: c.body,
          createdAt: c.created_at,
        }))
      } catch {
        return []
      }
    },
  }
}
