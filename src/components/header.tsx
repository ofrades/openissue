import { TextAttributes } from "@opentui/core"
import type { AppState } from "./state.ts"

export function Header(props: { state: AppState }) {
  return (
    <box
      width="100%"
      height={1}
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <text
        fg="#7c3aed"
        attributes={TextAttributes.BOLD}
        content="🐛 ideae"
      />
      <text fg="#8b949e" content={props.state.providerLabel()} />
    </box>
  )
}
