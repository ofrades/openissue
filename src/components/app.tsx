import { createSignal, createMemo, createEffect, onMount } from "solid-js";
import { useKeyboard, usePaste, useRenderer } from "@opentui/solid";
import { SyntaxStyle, TextAttributes } from "@opentui/core";
import type {
  InputRenderable,
  KeyEvent,
  PasteEvent,
  TextareaRenderable,
} from "@opentui/core";
import type { AppState } from "./state.ts";
import type { Issue, Comment } from "../types.ts";
import { randomUUID } from "node:crypto";
import { findFiles } from "../store/files.ts";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

export function App(props: { state: AppState; cwd: string }) {
  const [message, setMessage] = createSignal("");
  const [shouldExit, setShouldExit] = createSignal(false);
  const [mode, setMode] = createSignal<"list" | "read" | "edit">("list");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [readingId, setReadingId] = createSignal<string | null>(null);
  const [activeField, setActiveField] = createSignal<"title" | "desc">("title");
  const [titleValue, setTitleValue] = createSignal("");
  const [descValue, setDescValue] = createSignal("");
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [suggestionType, setSuggestionType] = createSignal<"file" | "issue">(
    "file",
  );
  const [fileSuggestions, setFileSuggestions] = createSignal<string[]>([]);
  const [issueSuggestions, setIssueSuggestions] = createSignal<Issue[]>([]);
  const [suggestionIndex, setSuggestionIndex] = createSignal(0);
  const [comments, setComments] = createSignal<Comment[]>([]);
  let suggestionSeq = 0;

  const colors = {
    background: "#1a1816",
    panel: "#1a1816",
    panelInset: "#222220",
    border: "#3d3832",
    borderMuted: "#4a443d",
    textMuted: "#a18f7a",
    textDim: "#6b625a",
    text: "#d4c5b0",
    textStrong: "#f4ede4",
    primary: "#d97706",
    primaryBright: "#f59e0b",
    accent: "#cc9b6d",
    accentBg: "#F7AE82",
    highlight: "#2d2722",
  } as const;

  const syntaxStyle = SyntaxStyle.fromTheme([
    { scope: ["default"], style: { foreground: colors.text } },
    {
      scope: ["comment"],
      style: { foreground: colors.textMuted, italic: true },
    },
    { scope: ["keyword"], style: { foreground: colors.primary, bold: true } },
    { scope: ["string"], style: { foreground: "#9dc896" } },
    { scope: ["number"], style: { foreground: "#88b8d8" } },
    { scope: ["punctuation"], style: { foreground: colors.textMuted } },
    { scope: ["markup"], style: { foreground: colors.textStrong } },
    {
      scope: ["markup.heading"],
      style: { foreground: colors.textStrong, bold: true },
    },
    {
      scope: ["markup.italic"],
      style: { foreground: colors.textStrong, italic: true },
    },
    {
      scope: ["markup.bold"],
      style: { foreground: colors.textStrong, bold: true },
    },
    { scope: ["markup.list"], style: { foreground: colors.textMuted } },
    { scope: ["markup.code"], style: { foreground: "#a8c5d8" } },
    {
      scope: ["markup.link"],
      style: { foreground: "#88a8c8", underline: true },
    },
    {
      scope: ["markup.quote"],
      style: { foreground: colors.textMuted, italic: true },
    },
  ]);

  let titleInput: InputRenderable | undefined;
  let descTextarea: TextareaRenderable | undefined;
  const renderer = useRenderer();

  const provider = props.state.provider();
  const issues = createMemo(() => props.state.issues());
  const issueOptions = createMemo(() =>
    issues().map((issue) => {
      const status = issue.status === "open" ? "[ ]" : "[x]";
      const issueId = issue.remoteNumber
        ? `#${issue.remoteNumber}`
        : `#${issue.id.slice(0, 8)}`;
      const maxTitleLength = 50;
      const trimmedTitle =
        issue.title.length > maxTitleLength
          ? `${issue.title.slice(0, maxTitleLength).trimEnd()}...`
          : issue.title;
      return {
        name: ` ${status} ${issueId.padEnd(12)} ${trimmedTitle} `,
        description: "",
        value: issue.id,
      };
    }),
  );
  const stats = createMemo(() => {
    const list = issues();
    let open = 0;
    let closed = 0;
    let synced = 0;
    list.forEach((issue) => {
      if (issue.status === "open") {
        open += 1;
      } else {
        closed += 1;
      }
      if (issue.remoteNumber) synced += 1;
    });
    const total = list.length;
    return {
      total,
      open,
      closed,
      synced,
      local: total - synced,
    };
  });
  const suggestionOptions = createMemo(() => {
    const type = suggestionType();
    if (type === "issue") {
      return issueSuggestions().map((issue) => {
        const displayId = issue.remoteNumber
          ? `#${issue.remoteNumber}`
          : `#${issue.id.substring(0, 8)}`;
        const statusIcon = issue.status === "open" ? "[ ]" : "[x]";
        return {
          name: `${statusIcon} ${displayId} ${issue.title}`,
          description:
            issue.body.substring(0, 50) + (issue.body.length > 50 ? "..." : ""),
          value: issue.remoteNumber?.toString() ?? issue.id.substring(0, 8),
        };
      });
    } else {
      return fileSuggestions().map((file) => ({
        name: file,
        description: "",
        value: file,
      }));
    }
  });
  const selectedIssue = createMemo(() => {
    const list = issues();
    if (list.length === 0) return null;
    const idx = Math.min(selectedIndex(), list.length - 1);
    return list[idx] ?? null;
  });

  createEffect(() => {
    const list = issues();
    if (list.length === 0) {
      if (selectedIndex() !== 0) setSelectedIndex(0);
      return;
    }
    const maxIndex = list.length - 1;
    if (selectedIndex() > maxIndex) setSelectedIndex(maxIndex);
  });

  onMount(async () => {
    if (!provider) return;
    try {
      const existingRemote = new Set(
        props.state.store.issues
          .filter(
            (issue) => issue.provider === provider.type && issue.remoteNumber,
          )
          .map((issue) => issue.remoteNumber as number),
      );
      const remoteIssues = await provider.listIssues();
      let added = 0;
      remoteIssues.forEach((issue) => {
        if (
          !existingRemote.has(issue.remoteNumber ?? -1) &&
          !props.state.store.get(issue.id)
        ) {
          props.state.store.add(issue);
          added += 1;
        }
      });
      if (added > 0) {
        await props.state.store.save();
      }
    } catch {}
  });

  useKeyboard((key) => {
    const keyName = key.name.toLowerCase();
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      return;
    }

    if (keyName === "q") {
      renderer.destroy();
      return;
    }

    if (mode() === "read") {
      if (keyName === "escape" || keyName === "space") {
        key.preventDefault();
        setComments([]);
        setMode("list");
      }
      return;
    }

    if (mode() === "list" && keyName === "n") {
      key.preventDefault();
      openNew();
      return;
    }

    if (mode() === "list" && keyName === "e") {
      key.preventDefault();
      const issue = selectedIssue();
      if (issue) {
        openEdit(issue);
      } else {
        openNew();
      }
      return;
    }

    if (
      mode() === "list" &&
      (keyName === "enter" || keyName === "return" || keyName === "linefeed")
    ) {
      key.preventDefault();
      const issue = selectedIssue();
      if (issue) {
        openEdit(issue);
      } else {
        openNew();
      }
    }

    if (mode() === "list" && keyName === "space") {
      key.preventDefault();
      const issue = selectedIssue();
      if (issue) {
        openRead(issue);
      }
      return;
    }

    if (mode() === "list" && keyName === "x") {
      key.preventDefault();
      const issue = selectedIssue();
      if (issue) {
        toggleIssueStatus(issue);
      }
    }
  });

  usePaste((event) => {
    if (mode() !== "edit") return;
    void handlePaste(event);
  });

  if (shouldExit()) {
    return null;
  }

  function openNew() {
    setEditingId(null);
    setMessage("");
    setShowSuggestions(false);
    setMode("edit");
  }

  function openEdit(issue: Issue) {
    setEditingId(issue.id);
    setMessage("");
    setShowSuggestions(false);
    setMode("edit");
  }

  async function openRead(issue: Issue) {
    setReadingId(issue.id);
    setMessage("");
    setShowSuggestions(false);
    setMode("read");

    if (provider && issue.remoteNumber && issue.provider === provider.type) {
      setMessage("Loading comments...");
      try {
        const issueComments = await provider.getIssueComments(
          issue.remoteNumber,
        );
        setComments(issueComments);
        setMessage("");
      } catch {
        setComments([]);
        setMessage("Failed to load comments");
      }
    } else {
      setComments([]);
    }
  }

  async function toggleIssueStatus(issue: Issue) {
    const newStatus = issue.status === "open" ? "closed" : "open";
    props.state.store.update(issue.id, { status: newStatus });
    await props.state.store.save();

    if (provider && issue.remoteNumber && issue.provider === provider.type) {
      try {
        if (newStatus === "closed") {
          await provider.closeIssue(issue.remoteNumber);
          setMessage(`Closed #${issue.remoteNumber} on ${provider.type}`);
        } else {
          await provider.reopenIssue(issue.remoteNumber);
          setMessage(`Reopened #${issue.remoteNumber} on ${provider.type}`);
        }
      } catch {
        setMessage(
          `${newStatus === "closed" ? "Closed" : "Reopened"} locally (remote sync failed)`,
        );
      }
    } else {
      setMessage(
        `${newStatus === "closed" ? "Closed" : "Reopened"} #${formatIssueId(issue.id)}`,
      );
    }
  }

  createEffect(() => {
    if (mode() !== "edit") return;
    const issue = editingId() ? props.state.store.get(editingId()!) : null;
    const nextTitle = issue?.title ?? "";
    const nextDesc = issue?.body ?? "";
    setTitleValue(nextTitle);
    setDescValue(nextDesc);
    if (titleInput && titleInput.value !== nextTitle) {
      titleInput.value = nextTitle;
    }
    if (descTextarea && descTextarea.plainText !== nextDesc) {
      descTextarea.setText(nextDesc);
    }
    // Use queueMicrotask to ensure focus is set after setText completes
    queueMicrotask(() => setActiveField("title"));
  });

  async function updateFileSuggestions(text: string) {
    // Check for issue reference (#)
    const issueMatch = text.match(/#([\w]*)$/);
    if (issueMatch) {
      const query = issueMatch[1]?.toLowerCase() ?? "";
      const currentSeq = ++suggestionSeq;

      // Filter issues by ID, title, or remote number
      const issues = props.state.store.issues
        .filter((issue) => {
          const id = issue.id.toLowerCase();
          const title = issue.title.toLowerCase();
          const remoteNumber = issue.remoteNumber?.toString() ?? "";

          return (
            id.includes(query) ||
            title.includes(query) ||
            remoteNumber.includes(query)
          );
        })
        .slice(0, 10); // Limit to 10 suggestions

      if (currentSeq !== suggestionSeq) return;

      if (issues.length === 0) {
        setShowSuggestions(false);
        return;
      }

      setIssueSuggestions(issues);
      setSuggestionType("issue");
      setSuggestionIndex(0);
      setShowSuggestions(true);
      return;
    }

    // Check for file reference (@)
    const fileMatch = text.match(/@([\w./-]*)$/);
    if (fileMatch) {
      const query = fileMatch[1] ?? "";
      const currentSeq = ++suggestionSeq;
      const files = await findFiles(props.cwd, query);
      if (currentSeq !== suggestionSeq) return;

      if (files.length === 0) {
        setShowSuggestions(false);
        return;
      }

      setFileSuggestions(files);
      setSuggestionType("file");
      setSuggestionIndex(0);
      setShowSuggestions(true);
      return;
    }

    setShowSuggestions(false);
  }

  function applySuggestion(text: string, selected: string) {
    if (suggestionType() === "issue") {
      const replacement = `#${selected} `;
      const replacePattern = /#[\w]*$/;
      if (!replacePattern.test(text)) return `${text}${replacement}`;
      return text.replace(replacePattern, replacement);
    } else {
      const replacement = `@${selected} `;
      const replacePattern = /@[\w./-]*$/;
      if (!replacePattern.test(text)) return `${text}${replacement}`;
      return text.replace(replacePattern, replacement);
    }
  }

  function acceptSuggestion(index?: number) {
    const type = suggestionType();
    const items = type === "issue" ? issueSuggestions() : fileSuggestions();
    const idx = index ?? suggestionIndex();
    if (idx < 0 || idx >= items.length) {
      setShowSuggestions(false);
      return;
    }

    const item = items[idx]!;
    const selected =
      type === "issue"
        ? ((item as Issue).remoteNumber?.toString() ??
          (item as Issue).id.substring(0, 8))
        : (item as string);

    if (activeField() === "title") {
      const current = titleInput?.value ?? titleValue();
      const nextText = applySuggestion(current, selected);
      setTitleValue(nextText);
      if (titleInput) titleInput.value = nextText;
    } else {
      const current = descTextarea?.plainText ?? descValue();
      const nextText = applySuggestion(current, selected);
      setDescValue(nextText);
      if (descTextarea) descTextarea.setText(nextText);
    }
    setShowSuggestions(false);
  }

  function moveSuggestion(delta: number) {
    const type = suggestionType();
    const items = type === "issue" ? issueSuggestions() : fileSuggestions();
    if (items.length === 0) return;
    const next = (suggestionIndex() + delta + items.length) % items.length;
    setSuggestionIndex(next);
  }

  async function saveIssue() {
    setShowSuggestions(false);
    const title = titleValue().trim();
    if (!title) {
      setMessage("Title is required");
      return;
    }

    const body = descValue();
    const existingId = editingId();

    if (existingId) {
      props.state.store.update(existingId, { title, body });
      await props.state.store.save();
      setMode("list");
      setMessage(`Updated todo ${formatIssueId(existingId)}`);
      return;
    }

    const now = new Date().toISOString();
    const issue: Issue = {
      id: randomUUID().slice(0, 8),
      title,
      body,
      status: "open",
      priority: "medium",
      labels: [],
      files: [],
      createdAt: now,
      updatedAt: now,
    };

    props.state.store.add(issue);
    await props.state.store.save();

    if (provider) {
      try {
        const remoteNumber = await provider.createIssue(title, body, []);
        props.state.store.update(issue.id, {
          remoteNumber,
          provider: provider.type,
        });
        await props.state.store.save();
        setMessage(`Created todo #${remoteNumber} on ${provider.type}`);
      } catch {
        setMessage(
          `Created todo ${formatIssueId(issue.id)} (remote sync failed)`,
        );
      }
    } else {
      setMessage(`Created todo ${formatIssueId(issue.id)}`);
    }

    setMode("list");
  }

  function formatIssueId(id: string) {
    const issue = props.state.store.get(id);
    if (issue?.remoteNumber) return `#${issue.remoteNumber}`;
    return `#${id}`;
  }

  function handleTitleKeyDown(e: KeyEvent) {
    setActiveField("title");

    if (e.name === "escape") {
      e.preventDefault();
      setMode("list");
      setShowSuggestions(false);
      return;
    }

    if (showSuggestions()) {
      if (e.name === "down") {
        e.preventDefault();
        moveSuggestion(1);
        return;
      }
      if (e.name === "up") {
        e.preventDefault();
        moveSuggestion(-1);
        return;
      }
      if (e.name === "tab" || e.name === "return" || e.name === "enter") {
        e.preventDefault();
        acceptSuggestion();
        return;
      }
      if (e.name === "escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.name === "tab") {
      e.preventDefault();
      setActiveField("desc");
    }
  }

  function handleDescKeyDown(e: KeyEvent) {
    setActiveField("desc");

    if (e.name === "escape") {
      e.preventDefault();
      setMode("list");
      setShowSuggestions(false);
      return;
    }

    if (e.name === "return" && e.shift) {
      e.preventDefault();
      if (descTextarea) {
        descTextarea.insertText("\n");
        setDescValue(descTextarea.plainText);
      }
      return;
    }

    if (showSuggestions()) {
      if (e.name === "down") {
        e.preventDefault();
        moveSuggestion(1);
        return;
      }
      if (e.name === "up") {
        e.preventDefault();
        moveSuggestion(-1);
        return;
      }
      if (e.name === "tab" || e.name === "return" || e.name === "enter") {
        e.preventDefault();
        acceptSuggestion();
        return;
      }
      if (e.name === "escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.name === "return" || e.name === "enter") {
      e.preventDefault();
      void saveIssue();
      return;
    }

    if (e.name === "tab") {
      e.preventDefault();
      setActiveField("title");
    }
  }

  function handleTitleInput(value: string) {
    setActiveField("title");
    setTitleValue(value);
    void updateFileSuggestions(value);
  }

  function handleDescInput(value: string) {
    setActiveField("desc");
    setDescValue(value);
    void updateFileSuggestions(value);
  }

  async function handlePaste(event: PasteEvent) {
    if (event.text && event.text.startsWith("data:image/")) {
      event.preventDefault();
      const match = event.text.match(
        /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/,
      );
      if (!match) return;
      const extensionRaw = match[1];
      const data = match[2];
      if (!extensionRaw || !data) return;
      const extension = extensionRaw === "jpeg" ? "jpg" : extensionRaw;
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const filePath = await saveImage(bytes, extension);
      if (filePath) insertImageReference(filePath);
      return;
    }

    if (event.text && event.text.trim()) {
      return;
    }

    event.preventDefault();
    const clipboardImage = await readClipboardImage();
    if (!clipboardImage) return;
    const filePath = await saveImage(
      clipboardImage.bytes,
      clipboardImage.extension,
    );
    if (filePath) insertImageReference(filePath);
  }

  function insertImageReference(filePath: string) {
    const relativePath = filePath.startsWith(props.cwd)
      ? filePath.slice(props.cwd.length + 1)
      : filePath;
    const markdown = `\n![image](${relativePath})\n`;
    if (activeField() === "title") {
      if (!titleInput) return;
      titleInput.insertText(markdown);
      setTitleValue(titleInput.value);
      setActiveField("title");
      return;
    }

    if (!descTextarea) return;
    descTextarea.insertText(markdown);
    setDescValue(descTextarea.plainText);
    setActiveField("desc");
  }

  async function saveImage(bytes: Uint8Array, extension: string) {
    try {
      const dir = resolve(props.cwd, ".openissue", "images");
      await mkdir(dir, { recursive: true });
      const filename = `paste-${Date.now()}.${extension}`;
      const filePath = resolve(dir, filename);
      await Bun.write(filePath, bytes);
      return filePath;
    } catch {
      return null;
    }
  }

  async function readClipboardImage(): Promise<{
    bytes: Uint8Array;
    extension: string;
  } | null> {
    const wlPaste = await spawnClipboard(
      ["wl-paste", "--type", "image/png", "--no-newline"],
      "png",
    );
    if (wlPaste) return wlPaste;
    const xclip = await spawnClipboard(
      ["xclip", "-selection", "clipboard", "-t", "image/png", "-o"],
      "png",
    );
    if (xclip) return xclip;
    return null;
  }

  async function spawnClipboard(command: string[], extension: string) {
    try {
      const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
      const buffer = await new Response(proc.stdout).arrayBuffer();
      const code = await proc.exited;
      if (code !== 0) return null;
      if (buffer.byteLength === 0) return null;
      return { bytes: new Uint8Array(buffer), extension };
    } catch {
      return null;
    }
  }

  const hintText = () => {
    if (mode() === "list") {
      return "n: new  up/down/j/k: nav  space: view  enter/e: edit  x: close  q: quit";
    }
    if (mode() === "read") {
      return "esc/q: back";
    }
    return "tab: navigate  enter: save  esc: cancel";
  };

  const titlePlaceholder = () =>
    editingId() ? "Edit todo (issue)" : "New todo (issue)";

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={colors.background}
    >
      <box
        width="100%"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        borderStyle="single"
        borderColor={colors.border}
      >
        <box flexDirection="row" gap={2}>
          <text
            fg={colors.primary}
            attributes={TextAttributes.BOLD}
            content="📋 openissue"
          />
          <text fg={colors.textMuted} content={props.state.providerLabel()} />
        </box>
        <text fg={colors.textDim} content={hintText()} />
      </box>

      <box width="100%" flexGrow={1}>
        {mode() === "list" ? (
          <box
            width="100%"
            flexGrow={1}
            backgroundColor={colors.panel}
            flexDirection="column"
          >
            <box
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              paddingLeft={2}
              paddingRight={2}
              paddingTop={1}
              paddingBottom={1}
            >
              <box flexDirection="row" gap={3}>
                <text
                  fg={colors.textMuted}
                  content={`Total ${stats().total}`}
                />
                <text fg={colors.primary} content={`Open ${stats().open}`} />
                <text
                  fg={colors.textMuted}
                  content={`Closed ${stats().closed}`}
                />
              </box>
              <box flexDirection="row" gap={3}>
                <text
                  fg={colors.textMuted}
                  content={`Synced ${stats().synced}`}
                />
                <text
                  fg={colors.textMuted}
                  content={`Local ${stats().local}`}
                />
              </box>
            </box>
            {message() && (
              <box height={1} paddingLeft={2} paddingBottom={1}>
                <text fg={colors.primary} content={message()} />
              </box>
            )}
            {issueOptions().length === 0 ? (
              <box paddingLeft={2} paddingTop={2}>
                <text
                  fg={colors.textDim}
                  content="No todos yet. Press 'n' to create one."
                />
              </box>
            ) : (
              <select
                width="100%"
                height="100%"
                options={issueOptions()}
                selectedIndex={selectedIndex()}
                showScrollIndicator
                focused
                backgroundColor="transparent"
                selectedBackgroundColor={colors.primary}
                textColor={colors.textStrong}
                selectedTextColor={colors.highlight}
                onChange={(index) => setSelectedIndex(index)}
                onSelect={(index) => {
                  const issue = issues()[index];
                  if (issue) openEdit(issue);
                }}
              />
            )}
          </box>
        ) : mode() === "read" ? (
          (() => {
            const issue = readingId()
              ? props.state.store.get(readingId()!)
              : null;
            return (
              <box
                width="100%"
                flexGrow={1}
                backgroundColor={colors.panel}
                padding={2}
                flexDirection="column"
                gap={2}
              >
                <box
                  height={3}
                  borderStyle="single"
                  borderColor={colors.border}
                  backgroundColor={colors.panelInset}
                  paddingLeft={2}
                  paddingRight={2}
                  flexDirection="row"
                  alignItems="center"
                >
                  <text
                    fg={colors.textStrong}
                    attributes={TextAttributes.BOLD}
                    content={issue?.title || ""}
                  />
                </box>

                {message() && (
                  <box height={1}>
                    <text fg={colors.textMuted} content={message()} />
                  </box>
                )}

                <box
                  flexGrow={1}
                  borderStyle="single"
                  borderColor={colors.border}
                  backgroundColor={colors.panelInset}
                  padding={2}
                >
                  <scrollbox width="100%" flexGrow={1}>
                    <box flexDirection="column" gap={1}>
                      <code
                        content={issue?.body || "No description"}
                        filetype="markdown"
                        syntaxStyle={syntaxStyle}
                        wrapMode="word"
                        bg="transparent"
                      />
                      {comments().length > 0 && (
                        <box flexDirection="column" gap={1} marginTop={2}>
                          <text
                            fg={colors.textMuted}
                            content="─── Comments ───"
                          />
                          {comments().map((comment) => (
                            <box flexDirection="column" gap={0} marginTop={1}>
                              <text
                                fg={colors.primary}
                                attributes={TextAttributes.BOLD}
                                content={`@${comment.author} · ${new Date(comment.createdAt).toLocaleDateString()}`}
                              />
                              <text fg={colors.text} content={comment.body} />
                            </box>
                          ))}
                        </box>
                      )}
                    </box>
                  </scrollbox>
                </box>
              </box>
            );
          })()
        ) : (
          <box
            width="100%"
            flexGrow={1}
            backgroundColor={colors.panel}
            flexDirection="column"
            padding={2}
            gap={2}
          >
            <box
              height={3}
              borderStyle="single"
              borderColor={
                activeField() === "title" ? colors.primary : colors.border
              }
              backgroundColor={colors.panelInset}
              paddingLeft={2}
              paddingRight={2}
              flexDirection="row"
              alignItems="center"
            >
              <input
                ref={(renderable) => {
                  titleInput = renderable;
                  if (!renderable) return;
                  if (renderable.value !== titleValue()) {
                    renderable.value = titleValue();
                  }
                }}
                width="100%"
                flexGrow={1}
                value={titleValue()}
                placeholder={titlePlaceholder()}
                textColor={colors.text}
                cursorColor={colors.primary}
                backgroundColor="transparent"
                focusedBackgroundColor="transparent"
                placeholderColor={colors.textDim}
                onSubmit={saveIssue}
                onKeyDown={handleTitleKeyDown}
                onInput={handleTitleInput}
                focused={activeField() === "title"}
              />
            </box>

            {message() && (
              <box height={1}>
                <text fg={colors.primary} content={message()} />
              </box>
            )}

            <box
              flexGrow={1}
              borderStyle="single"
              borderColor={
                activeField() === "desc" ? colors.primary : colors.border
              }
              backgroundColor={colors.panelInset}
              padding={2}
            >
              <textarea
                ref={(renderable) => {
                  descTextarea = renderable;
                  if (!renderable) return;
                  if (renderable.plainText !== descValue()) {
                    renderable.setText(descValue());
                  }
                }}
                flexGrow={1}
                placeholder="Description (markdown supported)"
                textColor={colors.text}
                cursorColor={colors.primary}
                backgroundColor="transparent"
                focusedBackgroundColor="transparent"
                placeholderColor={colors.textDim}
                wrapMode="word"
                syntaxStyle={syntaxStyle}
                tabIndicator="  "
                onSubmit={saveIssue}
                onKeyDown={handleDescKeyDown}
                onContentChange={() =>
                  handleDescInput(descTextarea?.plainText ?? "")
                }
                focused={activeField() === "desc"}
              />
            </box>

            {showSuggestions() && suggestionOptions().length > 0 && (
              <box
                width="100%"
                maxHeight={12}
                borderStyle="single"
                borderColor={colors.primary}
                backgroundColor={colors.panelInset}
                zIndex={100}
              >
                <select
                  width="100%"
                  height={Math.min(8, suggestionOptions().length)}
                  options={suggestionOptions()}
                  selectedIndex={suggestionIndex()}
                  showScrollIndicator
                  backgroundColor="transparent"
                  selectedBackgroundColor={colors.primary}
                  selectedTextColor={colors.highlight}
                  textColor={colors.textMuted}
                  descriptionColor={colors.textMuted}
                  selectedDescriptionColor={colors.textStrong}
                  onChange={(index) => setSuggestionIndex(index)}
                  onSelect={(index) => acceptSuggestion(index)}
                />
              </box>
            )}
          </box>
        )}
      </box>
    </box>
  );
}
