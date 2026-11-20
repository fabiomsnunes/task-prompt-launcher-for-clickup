# Task Prompt Launcher for ClickUp

A Chrome/Brave extension that adds a button to the ClickUp task view. One click
opens your coding agent (Claude Code or Codex) with a prompt built from the
task; the caret next to it opens the other tools, or copies the prompt.

Not affiliated with ClickUp, Anthropic or OpenAI.

## Install

1. Download the zip from the [latest release](../../releases/latest) and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`) and turn on
   **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.

Keep the folder where it is: the browser loads the extension from it. To update,
replace its contents with the new release and click reload on the extension's
card.

The first time, the browser asks before opening the Claude app. Tick "Always
allow" for `app.clickup.com`.

## Use

Open a task and click the button next to **Share**. It shows the icon of the
tool it opens, which you pick under **Main button** on the options page. If the
header is not recognised, the button floats in the bottom-right corner.

| Action | What it does |
| --- | --- |
| Open in Claude Code | `claude://code/new?q=<prompt>`. Needs the Claude desktop app |
| Open in Codex | `codex://threads/new?prompt=<prompt>`. Needs the Codex app |
| Open in Claude.ai | `https://claude.ai/new?q=<prompt>` in a new tab |
| Open in ChatGPT | `https://chatgpt.com/?q=<prompt>` in a new tab |
| Copy prompt | Copies the prompt to the clipboard |
| Copy task ID | Copies only the ID |
| Edit templates | Opens the options page |

Nothing is sent on its own: each destination only fills in the prompt.

## Templates

Two templates, edited on the options page and synced with your browser profile:
one for Claude Code and Codex, one for the web apps. Click a shortcode to insert it.

| Shortcode | Value |
| --- | --- |
| `{id}` | Task ID (custom ID when the workspace uses them) |
| `{name}` | Task name |
| `{url}` | Task URL |
| `{date}` | Due date as ClickUp shows it; `Today`, `Tomorrow` and `Yesterday` get the real date added |
| `{priority}` | Priority |
| `{tags}` | Tags, comma-separated |
| `{assignees}` | Assignees, comma-separated |
| `{list}` | The list the task is in |

The default Claude Code template only sends the ID and name. That is enough
when the agent has the ClickUp MCP server connected; without it, add `{url}` and whatever else you need.

The fields are read from the page, so they break if ClickUp changes its markup.
Open an issue if one comes out empty.

## Development

```bash
node scripts/validate.mjs
node scripts/build.mjs
```

`build.mjs` writes `dist/` (load it with **Load unpacked**) and the release zip.
Pushing a `vX.Y.Z` tag publishes a release with that zip.

The `key` in `manifest.json` pins the extension ID, so it stays the same
whatever folder it is loaded from and saved templates survive a move.

## License

[MIT](LICENSE)
