# 🐛 openissue

Minimal TUI issue tracker for GitHub and GitLab. Create, edit, and view issues with comments from your terminal.

Inspired by [OpenCode](https://opencode.ai) design. Built with [OpenTUI](https://github.com/anomalyco/opentui) + [SolidJS](https://www.solidjs.com/) + [Bun](https://bun.sh).

## Install

```bash
bun install -g openissue
```

Or clone and run locally:

```bash
git clone <repo-url> && cd opengit
bun install
bun run dev
```

## Usage

Run `openissue` in any git repository:

```bash
cd your-project
openissue
```

## Interface

```
┌─ 🐛 openissue ───────────────────────────── github: owner/repo ─┐
│ n: new  up/down/j/k: nav  space: view  enter/e: edit  x: close  q: quit        │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ [ ] #1 Do something A                                        │ │
│ │ [ ] #2 Do something B                                        │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Creating Issues

1. **Press n** to create a new issue
2. **Type description** and **title**
3. **Press Enter** to save

## Viewing Issues

1. **Navigate** to an issue using ↑/↓ or j/k
2. **Press Space** to view issue details and comments
3. **Press Space or Esc** to go back to the list

Comments are automatically fetched from GitHub/GitLab when viewing a remote issue.

## Provider Integration

openissue auto-detects GitHub or GitLab from your git remote:

- **GitHub**: Uses `gh` CLI -- [install](https://cli.github.com/)
- **GitLab**: Uses `glab` CLI -- [install](https://gitlab.com/gitlab-org/cli)

**Workflow:**
```
n → New issue → Enter → Creates local issue
Space → View issue details and comments
x → Toggle issue open/closed status
q → Quit
```

## Storage

Issues are stored locally in `.opengit/issues.json`:

```json
[
  {
    "id": "abc123",
    "title": "Fix bug",
    "body": "Description...",
    "status": "open",
    "files": [{"path": "src/index.ts"}],
    "remoteNumber": 42
  }
]
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | New todo |
| `↑/↓` or `j/k` | Navigate list |
| `Space` | View issue (read mode) |
| `Enter` or `e` | Edit issue |
| `x` | Close open issue |
| `Tab` | Switch between title/description |
| `Esc` or `q` | Cancel / go back |
| `Ctrl+C` or `q` | Exit |


## Development

```bash
bun run dev        # Run in development mode
bun run build      # Build to dist/
bunx tsc --noEmit  # Type check
```

## Project Structure

```
src/
  components/
    app.tsx           # Two-screen layout (list + new/edit)
    header.tsx        # Top header bar
    issue-list.tsx    # Todo list
    state.ts          # Reactive state management
  store/
    index.ts          # JSON persistence
  provider/
    index.ts          # GitHub/GitLab CLI integration
  types.ts            # Core TypeScript types
```
