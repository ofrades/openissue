import type { FileRef } from "../types.ts"
import { resolve, relative } from "node:path"

/**
 * Find files matching a fuzzy query in the project directory.
 * Uses `git ls-files` for fast, gitignore-aware file listing.
 */
export async function findFiles(cwd: string, query: string): Promise<string[]> {
  if (!query) return []

  try {
    const proc = Bun.spawn(["git", "ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    })
    const out = await new Response(proc.stdout).text()
    await proc.exited

    const files = out
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)

    const q = query.toLowerCase()
    return files
      .filter((f) => f.toLowerCase().includes(q))
      .slice(0, 20)
  } catch {
    return []
  }
}

/**
 * Parse an @-reference string into a FileRef.
 * Supports: @path/to/file.ts or @path/to/file.ts#10-25
 */
export function parseAtRef(ref: string, cwd: string): FileRef | null {
  // Remove leading @
  let raw = ref.startsWith("@") ? ref.slice(1) : ref
  if (!raw) return null

  const lineMatch = raw.match(/^(.+?)#(\d+)(?:-(\d+))?$/)
  if (lineMatch) {
    return {
      path: lineMatch[1]!,
      lines: {
        start: parseInt(lineMatch[2]!, 10),
        end: lineMatch[3] ? parseInt(lineMatch[3], 10) : undefined,
      },
    }
  }

  return { path: raw }
}

/**
 * Extract all @file references from an input string.
 * Matches @word-like-paths that look like file paths.
 */
export function extractFileRefs(input: string, cwd: string): { text: string; refs: FileRef[] } {
  const refs: FileRef[] = []
  // Match @followed-by-a-path (must contain / or .)
  const re = /@([\w./-]+(?:#\d+(?:-\d+)?)?)/g
  let cleanText = input
  let m

  while ((m = re.exec(input)) !== null) {
    const raw = m[1]!
    // Only treat as file ref if it looks like a path (has . or /)
    if (raw.includes(".") || raw.includes("/")) {
      const ref = parseAtRef(raw, cwd)
      if (ref) refs.push(ref)
    }
  }

  // Remove @refs from the text for the issue body
  cleanText = input.replace(re, (match, g1: string) => {
    if (g1.includes(".") || g1.includes("/")) return ""
    return match
  }).replace(/\s+/g, " ").trim()

  return { text: cleanText, refs }
}

/**
 * Read file content for embedding in issue body.
 */
export async function readFileContent(
  cwd: string,
  ref: FileRef,
): Promise<string | null> {
  try {
    const fullPath = resolve(cwd, ref.path)
    const file = Bun.file(fullPath)
    if (!(await file.exists())) return null

    const content = await file.text()

    if (ref.lines) {
      const lines = content.split("\n")
      const start = Math.max(0, ref.lines.start - 1)
      const end = ref.lines.end ? ref.lines.end : ref.lines.start
      return lines.slice(start, end).join("\n")
    }

    return content
  } catch {
    return null
  }
}
