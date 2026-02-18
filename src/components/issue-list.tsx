import { For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import type { Issue } from "../types.ts"

const colors = {
  background: "#0f0e0d",
  panel: "#16141f",
  panelInset: "#1f1d2a",
  border: "#2d2a3d",
  borderMuted: "#3a3648",
  textMuted: "#9896a5",
  textDim: "#6e6b7f",
  text: "#d5d3e0",
  textStrong: "#f4f2ff",
  primary: "#8b7ff0",
  primaryBright: "#9f92f5",
  accent: "#b8a6ff",
  accentBg: "#6d5fff",
  highlight: "#221f32",
  success: "#6fcf97",
  info: "#56ccf2",
  warning: "#f2c94c",
  error: "#eb5757",
} as const

export function IssueList(props: { issues: Issue[]; selectedId?: string | null }) {
  return (
    <scrollbox width="100%" flexGrow={1}>
      <Show
        when={props.issues.length > 0}
        fallback={<text fg={colors.textDim} content="No todos yet" />}
      >
        <For each={props.issues}>
          {(issue) => <IssueRow issue={issue} selected={issue.id === props.selectedId} />}
        </For>
      </Show>
    </scrollbox>
  )
}

function IssueRow(props: { issue: Issue; selected: boolean }) {
  const statusColor = () => (props.issue.status === "open" ? colors.text : colors.textMuted)
  const checkbox = () => (props.issue.status === "open" ? "◯" : "✓")
  const issueId = () => (props.issue.remoteNumber ? `#${props.issue.remoteNumber}` : `#${props.issue.id}`)

  const content = () => {
    const title = props.issue.title
    const trimmed = title.length > 60 ? `${title.slice(0, 60).trimEnd()}...` : title
    const prefix = props.selected ? "▶ " : "  "
    return `${prefix}${checkbox()} ${issueId()} ${trimmed}`
  }

  return (
    <box 
      width="100%" 
      paddingLeft={1} 
      paddingRight={1} 
      paddingTop={0}
      paddingBottom={0}
      backgroundColor={props.selected ? colors.highlight : undefined}
    >
      <text
        fg={props.selected ? colors.primary : statusColor()}
        attributes={props.selected ? TextAttributes.BOLD : TextAttributes.NONE}
        content={content()}
      />
    </box>
  )
}
