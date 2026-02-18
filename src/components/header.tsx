import { TextAttributes } from "@opentui/core"
import type { AppState } from "./state.ts"

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
        fg={colors.primary}
        attributes={TextAttributes.BOLD}
        content="🐛 openissue"
      />
      <text fg={colors.textMuted} content={props.state.providerLabel()} />
    </box>
  )
}
