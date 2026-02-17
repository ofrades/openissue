import { createSignal, type Accessor, type Setter } from "solid-js"
import type { IssueStore, GitProvider, Issue } from "../types.ts"

export interface AppState {
  issues: Accessor<Issue[]>
  setIssues: Setter<Issue[]>
  messages: Accessor<string[]>
  addMessage: (msg: string) => void
  provider: Accessor<GitProvider | null>
  providerLabel: Accessor<string>
  store: IssueStore
}

export function createAppState(store: IssueStore, provider: GitProvider | null): AppState {
  const [issues, setIssues] = createSignal<Issue[]>(store.issues)
  const [messages, setMessages] = createSignal<string[]>([
    "Welcome to opentask.",
  ])
  const [providerSignal] = createSignal<GitProvider | null>(provider)

  const providerLabel = () => {
    const p = providerSignal()
    if (!p) return "local"
    return `${p.type}: ${p.repo}`
  }

  function addMessage(msg: string) {
    setMessages((prev) => [...prev.slice(-100), msg])
  }

  function refreshIssues() {
    setIssues([...store.issues])
  }

  // Monkey-patch store to auto-refresh signals
  const origAdd = store.add.bind(store)
  const origUpdate = store.update.bind(store)
  const origRemove = store.remove.bind(store)

  store.add = (issue: Issue) => {
    origAdd(issue)
    refreshIssues()
  }
  store.update = (id: string, patch: Partial<Issue>) => {
    origUpdate(id, patch)
    refreshIssues()
  }
  store.remove = (id: string) => {
    origRemove(id)
    refreshIssues()
  }

  return {
    issues,
    setIssues,
    messages,
    addMessage,
    provider: providerSignal,
    providerLabel,
    store,
  }
}
