import { For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import type { Issue } from "../types.ts"

export function IssueList(props: { issues: Issue[]; selectedId?: string | null }) {
  return (
    <scrollbox width="100%" flexGrow={1}>
      <Show
        when={props.issues.length > 0}
        fallback={<text fg="#666" content="No todos yet" />}
      >
        <For each={props.issues}>
          {(issue) => <IssueRow issue={issue} selected={issue.id === props.selectedId} />}
        </For>
      </Show>
    </scrollbox>
  )
}

function IssueRow(props: { issue: Issue; selected: boolean }) {
  const statusColor = () => (props.issue.status === "open" ? "#c9d1d9" : "#6b7280")
  const checkbox = () => (props.issue.status === "open" ? "[ ]" : "[x]")
  const issueId = () => (props.issue.remoteNumber ? `#${props.issue.remoteNumber}` : `#${props.issue.id}`)

  const content = () => {
    const title = props.issue.title
    const trimmed = title.length > 60 ? `${title.slice(0, 60).trimEnd()}...` : title
    const prefix = props.selected ? "> " : "  "
    return `${prefix}${checkbox()} ${issueId()} ${trimmed}`
  }

  return (
    <box width="100%" paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#1f2937" : undefined}>
      <text
        fg={props.selected ? "#e5e7eb" : statusColor()}
        attributes={props.selected ? TextAttributes.BOLD : TextAttributes.NONE}
        content={content()}
      />
    </box>
  )
}
