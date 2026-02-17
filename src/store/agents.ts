import type { AgentTask, AgentTaskStore } from "../types.ts"
import { resolve } from "node:path"

const STORE_FILE = ".openissue/agent-tasks.json"

export function createAgentTaskStore(cwd: string): AgentTaskStore {
  const filePath = resolve(cwd, STORE_FILE)
  let tasks: AgentTask[] = []

  const store: AgentTaskStore = {
    get tasks() {
      return tasks
    },

    add(task: AgentTask) {
      tasks.push(task)
    },

    update(id: string, patch: Partial<AgentTask>) {
      const idx = tasks.findIndex((t) => t.id === id)
      if (idx === -1) return
      tasks[idx] = { ...tasks[idx]!, ...patch, updatedAt: new Date().toISOString() }
    },

    remove(id: string) {
      tasks = tasks.filter((t) => t.id !== id)
    },

    get(id: string) {
      return tasks.find((t) => t.id === id)
    },

    getByPR(prNumber: number) {
      return tasks.filter((t) => t.pullRequestNumber === prNumber)
    },

    async save() {
      const dir = resolve(cwd, ".openissue")
      await Bun.write(resolve(dir, ".gitkeep"), "")
      await Bun.write(filePath, JSON.stringify(tasks, null, 2))
    },

    async load() {
      const file = Bun.file(filePath)
      if (await file.exists()) {
        try {
          tasks = JSON.parse(await file.text()) as AgentTask[]
        } catch {
          tasks = []
        }
      }
    },
  }

  return store
}
