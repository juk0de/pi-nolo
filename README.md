# pi-nolo

No-YOLO mode for [pi-coding-agent](https://github.com/nichochar/pi-mono). Gates `write`, `edit`, and `bash` tool calls behind user confirmation — press Enter to allow, Escape to block.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/burneikis/pi-nolo/main/confirm-all-writes.ts -o ~/.pi/agent/extensions/confirm-all-writes.ts
```

That's it — pi will discover the extension on next start.

## What it does

Every time the agent tries to:

- **Write a file** — confirms with the file path and line count
- **Edit a file** — confirms with the file path
- **Run a bash command** — confirms with the command string

You get a dialog: Enter to allow, Escape to block.

In non-interactive mode (no UI), all mutations are blocked by default.

## License

MIT
