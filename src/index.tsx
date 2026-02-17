import { render } from "@opentui/solid"
import { App } from "./components/app.tsx"
import { createAppState } from "./components/state.ts"
import { createStore } from "./store/index.ts"
import { detectProvider, createProvider } from "./provider/index.ts"
import { resolve } from "node:path"

async function main() {
  const cwd = process.cwd()

  // Ensure .opengit directory exists
  const dir = resolve(cwd, ".opengit")
  try {
    await Bun.write(resolve(dir, ".gitkeep"), "")
  } catch {
    // Directory might already exist
  }

  // Initialize store
  const store = createStore(cwd)
  await store.load()

  // Detect git provider
  let provider = null
  const detected = await detectProvider()
  if (detected) {
    provider = createProvider(detected.type, detected.repo)
  }

  // Create reactive state
  const state = createAppState(store, provider)

  // Render TUI
  render(() => <App state={state} cwd={cwd} />)
}

main().catch((err) => {
  console.error("opengit error:", err)
  process.exit(1)
})
