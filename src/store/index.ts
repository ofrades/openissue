import type { Issue, IssueStore } from "../types.ts"
import { resolve } from "node:path"

const STORE_FILE = ".opengit/issues.json"

export function createStore(cwd: string): IssueStore {
  const filePath = resolve(cwd, STORE_FILE)
  let issues: Issue[] = []

  const store: IssueStore = {
    get issues() {
      return issues
    },

    add(issue: Issue) {
      issues.push(issue)
    },

    update(id: string, patch: Partial<Issue>) {
      const idx = issues.findIndex((i) => i.id === id)
      if (idx === -1) return
      issues[idx] = { ...issues[idx]!, ...patch, updatedAt: new Date().toISOString() }
    },

    remove(id: string) {
      issues = issues.filter((i) => i.id !== id)
    },

    get(id: string) {
      return issues.find((i) => i.id === id)
    },

    async save() {
      const dir = resolve(cwd, ".opengit")
      await Bun.write(resolve(dir, ".gitkeep"), "")
      await Bun.write(filePath, JSON.stringify(issues, null, 2))
    },

    async load() {
      const file = Bun.file(filePath)
      if (await file.exists()) {
        try {
          issues = JSON.parse(await file.text()) as Issue[]
        } catch {
          issues = []
        }
      }
    },
  }

  return store
}
