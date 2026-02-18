import { render } from "@opentui/solid"
import { App } from "./components/app.tsx"
import { createAppState } from "./components/state.ts"
import { createStore } from "./store/index.ts"
import { createAgentTaskStore } from "./store/agents.ts"
import { detectProvider, createProvider } from "./provider/index.ts"
import { resolve } from "node:path"

async function main() {
  const cwd = process.cwd()

  // Ensure .ideae directory exists
  const dir = resolve(cwd, ".ideae")
  try {
    await Bun.write(resolve(dir, ".gitkeep"), "")
  } catch {
    // Directory might already exist
  }

  // Initialize stores
  const store = createStore(cwd)
  await store.load()

  const agentTaskStore = createAgentTaskStore(cwd)
  await agentTaskStore.load()

  // Detect git provider
  let provider = null
  const detected = await detectProvider()
  if (detected) {
    provider = createProvider(detected.type, detected.repo)
  }

  // Create reactive state
  const state = createAppState(store, agentTaskStore, provider)

  // Handle graceful shutdown to avoid Bun segfault
  const cleanup = () => {
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Render TUI
  render(() => <App state={state} cwd={cwd} />)
}

main().catch((err) => {
  console.error("ideae error:", err)
  process.exit(1)
})
