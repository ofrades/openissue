import { createSignal, createMemo, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import type { AgentTask, Issue } from "../types.ts"

interface AgentTaskViewProps {
  tasks: AgentTask[]
  issues: Issue[]
  onCreateTask: (description: string, issueNumber?: number) => Promise<void>
  onRefresh: () => Promise<void>
  onViewTask: (sessionId: string) => void
  colors: Record<string, string>
}

type TabView = "all" | "in_progress" | "completed" | "failed"

export function AgentView(props: AgentTaskViewProps) {
  const [activeTab, setActiveTab] = createSignal<TabView>("all")
  const [selectedTaskIndex, setSelectedTaskIndex] = createSignal(0)
  const [showCreateDialog, setShowCreateDialog] = createSignal(false)
  const [selectedIssueIndex, setSelectedIssueIndex] = createSignal(0)
  const [taskDescription, setTaskDescription] = createSignal("")

  // Filter tasks based on active tab
  const filteredTasks = createMemo(() => {
    const tab = activeTab()
    if (tab === "all") return props.tasks

    return props.tasks.filter((task) => {
      if (tab === "in_progress") return task.status === "in_progress" || task.status === "draft"
      if (tab === "completed") return task.status === "completed"
      if (tab === "failed") return task.status === "failed"
      return true
    })
  })

  // Tab options for tab_select
  const tabOptions = [
    { name: "All", description: "Show all tasks", value: "all" },
    { name: "Active", description: "In progress tasks", value: "in_progress" },
    { name: "Done", description: "Completed tasks", value: "completed" },
    { name: "Failed", description: "Failed tasks", value: "failed" },
  ]

  // Issue options for task creation
  const issueOptions = createMemo(() => [
    { name: "No issue", description: "Create task without linking an issue", value: "" },
    ...props.issues
      .filter((i) => i.status === "open")
      .map((issue) => ({
        name: `#${issue.remoteNumber || issue.id.slice(0, 8)}`,
        description: issue.title,
        value: String(issue.remoteNumber || ""),
      })),
  ])

  // Handle keyboard navigation
  useKeyboard((key) => {
    if (showCreateDialog()) {
      if (key.name === "escape") {
        setShowCreateDialog(false)
        setSelectedIssueIndex(0)
        setTaskDescription("")
      } else if (key.name === "up" || key.name === "k") {
        setSelectedIssueIndex((i) =>
          i > 0 ? i - 1 : issueOptions().length - 1
        )
      } else if (key.name === "down" || key.name === "j") {
        setSelectedIssueIndex((i) => (i + 1) % issueOptions().length)
      } else if (key.name === "return") {
        const issue = issueOptions()[selectedIssueIndex()]
        const issueNum = issue?.value ? parseInt(issue.value, 10) : undefined
        if (taskDescription().trim()) {
          props.onCreateTask(taskDescription(), issueNum)
          setShowCreateDialog(false)
          setSelectedIssueIndex(0)
          setTaskDescription("")
        }
      }
      return
    }

    // Main task list navigation
    if (key.name === "up" || key.name === "k") {
      setSelectedTaskIndex((i) =>
        i > 0 ? i - 1 : Math.max(0, filteredTasks().length - 1)
      )
    } else if (key.name === "down" || key.name === "j") {
      setSelectedTaskIndex((i) =>
        Math.min(i + 1, filteredTasks().length - 1)
      )
    } else if (key.name === "left" || key.raw === "[") {
      // Previous tab
      const tabs: TabView[] = ["all", "in_progress", "completed", "failed"]
      const current = tabs.indexOf(activeTab())
      const prev = current > 0 ? current - 1 : tabs.length - 1
      setActiveTab(tabs[prev]!)
      setSelectedTaskIndex(0)
    } else if (key.name === "right" || key.raw === "]") {
      // Next tab
      const tabs: TabView[] = ["all", "in_progress", "completed", "failed"]
      const current = tabs.indexOf(activeTab())
      const next = (current + 1) % tabs.length
      setActiveTab(tabs[next]!)
      setSelectedTaskIndex(0)
    } else if (key.name === "n") {
      // Create new agent task
      setShowCreateDialog(true)
    } else if (key.name === "r") {
      // Refresh agent tasks
      props.onRefresh()
    } else if (key.name === "return") {
      // View selected task details
      const task = filteredTasks()[selectedTaskIndex()]
      if (task) {
        props.onViewTask(task.id)
      }
    }
  })

  // Get status icon and color
  function getStatusDisplay(status: AgentTask["status"]) {
    switch (status) {
      case "draft":
        return { icon: "○", color: props.colors.textMuted }
      case "in_progress":
        return { icon: "◐", color: props.colors.primaryBright }
      case "completed":
        return { icon: "●", color: props.colors.primary }
      case "failed":
        return { icon: "✗", color: props.colors.textDim }
    }
  }

  const selectedTask = createMemo(() => {
    const tasks = filteredTasks()
    return tasks[selectedTaskIndex()]
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header with tabs */}
      <box
        flexDirection="row"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        borderStyle="single"
        borderColor={props.colors.border}
      >
        <text fg={props.colors.textStrong} attributes={TextAttributes.BOLD}>
          Agent Tasks
        </text>
        <box marginLeft={4}>
          <tab_select
            options={tabOptions}
            onChange={(index) => {
              const tabs: TabView[] = ["all", "in_progress", "completed", "failed"]
              setActiveTab(tabs[index]!)
              setSelectedTaskIndex(0)
            }}
            focused={!showCreateDialog()}
            tabWidth={12}
          />
        </box>
      </box>

      {/* Stats bar */}
      <box
        flexDirection="row"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={props.colors.highlight}
      >
        <text fg={props.colors.textMuted}>Total: {props.tasks.length}</text>
        <text fg={props.colors.primaryBright} marginLeft={2}>
          Active: {props.tasks.filter((t) => t.status === "in_progress" || t.status === "draft").length}
        </text>
        <text fg={props.colors.primary} marginLeft={2}>
          Done: {props.tasks.filter((t) => t.status === "completed").length}
        </text>
        <text fg={props.colors.textDim} marginLeft={2}>
          Failed: {props.tasks.filter((t) => t.status === "failed").length}
        </text>
      </box>

      {/* Main content */}
      <box flexDirection="row" flexGrow={1}>
        {/* Task list */}
        <box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor={props.colors.border}
        >
          <Show
            when={filteredTasks().length > 0}
            fallback={
              <box padding={2}>
                <text fg={props.colors.textMuted}>
                  No agent tasks found. Press 'n' to create one.
                </text>
              </box>
            }
          >
            <For each={filteredTasks()}>
              {(task, index) => {
                const isSelected = index() === selectedTaskIndex()
                const status = getStatusDisplay(task.status)

                return (
                  <box
                    flexDirection="column"
                    paddingLeft={2}
                    paddingRight={2}
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor={
                      isSelected ? props.colors.highlight : "transparent"
                    }
                  >
                    <box flexDirection="row">
                      <text fg={status.color}>{status.icon}</text>
                      <text
                        fg={isSelected ? props.colors.textStrong : props.colors.text}
                        marginLeft={2}
                        attributes={
                          isSelected ? TextAttributes.BOLD : TextAttributes.NONE
                        }
                      >
                        {task.title}
                      </text>
                    </box>
                    <box marginLeft={3} marginTop={0}>
                      <Show when={task.pullRequestNumber}>
                        <text fg={props.colors.primary}>
                          PR #{task.pullRequestNumber}
                        </text>
                      </Show>
                      <text fg={props.colors.textDim} marginLeft={2}>
                        {task.repository}
                      </text>
                    </box>
                  </box>
                )
              }}
            </For>
          </Show>
        </box>

        {/* Task details */}
        <box flexDirection="column" flexGrow={2} padding={2}>
          <Show when={selectedTask()}>
            {(task: () => AgentTask) => (
              <>
                <text fg={props.colors.textStrong} attributes={TextAttributes.BOLD}>
                  {task().title}
                </text>
                <box marginTop={1}>
                  <text fg={props.colors.textMuted}>
                    Status: {task().status}
                  </text>
                </box>
                <Show when={task().pullRequestNumber}>
                  <box marginTop={1}>
                    <text fg={props.colors.primary}>
                      Pull Request: #{task().pullRequestNumber}
                    </text>
                  </box>
                </Show>
                <box marginTop={1}>
                  <text fg={props.colors.textMuted}>
                    Repository: {task().repository}
                  </text>
                </box>
                <box marginTop={1}>
                  <text fg={props.colors.textMuted}>
                    Created: {new Date(task().createdAt).toLocaleString()}
                  </text>
                </box>
                <Show when={task().updatedAt}>
                  <box marginTop={1}>
                    <text fg={props.colors.textMuted}>
                      Updated: {new Date(task().updatedAt!).toLocaleString()}
                    </text>
                  </box>
                </Show>

                <box marginTop={2}>
                  <text fg={props.colors.textDim}>
                    Press Enter to view logs and details
                  </text>
                </box>
              </>
            )}
          </Show>
        </box>
      </box>

      {/* Create dialog */}
      <Show when={showCreateDialog()}>
        <box
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          backgroundColor={props.colors.background + "cc"}
          justifyContent="center"
          alignItems="center"
        >
          <box
            flexDirection="column"
            width={70}
            backgroundColor={props.colors.panel}
            borderStyle="single"
            borderColor={props.colors.border}
            padding={2}
          >
            <text fg={props.colors.textStrong} attributes={TextAttributes.BOLD}>
              Create Agent Task
            </text>
            <box marginTop={1}>
              <text fg={props.colors.textMuted}>
                Describe what you want the agent to do:
              </text>
            </box>
            <box marginTop={2}>
              <input
                value={taskDescription()}
                onInput={setTaskDescription}
                placeholder="e.g., Implement user authentication with JWT"
                focused={true}
                width={66}
              />
            </box>
            <box marginTop={2}>
              <text fg={props.colors.textMuted}>
                Link to an issue (optional):
              </text>
            </box>
            <box marginTop={1} height={8}>
              <select
                options={issueOptions()}
                onChange={(index) => setSelectedIssueIndex(index)}
                height={8}
              />
            </box>
            <box marginTop={2}>
              <text fg={props.colors.textDim}>
                Enter: Create | Esc: Cancel
              </text>
            </box>
          </box>
        </box>
      </Show>

      {/* Help footer */}
      <box
        flexDirection="row"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        borderStyle="single"
        borderColor={props.colors.border}
        backgroundColor={props.colors.highlight}
      >
        <text fg={props.colors.textDim}>
          ↑↓/jk: Navigate | ←→/[]: Tab | n: New | r: Refresh | Enter: View | q: Back
        </text>
      </box>
    </box>
  )
}
