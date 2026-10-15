# sidebar-folder-sections

A Claude Code plugin that brings back **folder grouping** in the Claude Desktop Code sidebar.

## Why

In October 2026 the Claude Desktop app moved the Code sidebar to a new *sections* layout (Pinned / Routines / Sessions). In that layout, **Group by: Project** groups sessions by environment or machine instead of by folder, so every local session ends up in one big list. There is no switch to get the old folder grouping back. See [anthropics/claude-code#78857](https://github.com/anthropics/claude-code/issues/78857).

What the new layout does have is **custom sections**: named sidebar sections you can file sessions into. This plugin creates one section per folder and files every new session into the right one, automatically.

## What it does

When a Code session starts in Claude Desktop, the plugin waits a few seconds and then:

1. works out the session's folder: the **git repo root** if it's inside a repo (so `my-app/src/api` and `my-app/.claude/worktrees/fix-123` both go under `my-app`), otherwise the folder itself. Your home folder becomes **Home**, and scratch or `/tmp` sessions become **Scratch**;
2. finds the sidebar section with that name, or creates it;
3. moves the session into it.

Each session is filed once. If you then move it somewhere else by hand, the plugin leaves it there.

It does nothing outside Claude Desktop (terminal sessions, `claude -p`), because there's no sidebar to file into.

## Install

In a terminal Claude Code session (the plugin command isn't available inside the desktop app's Code tab), run:

```
/plugin install sidebar-folder-sections --marketplace aayushagarwal-dev/claude-sidebar-folder-sections
```

Answer `y` to add the marketplace, then pick the **user** scope. Plugins installed at the user scope load in the desktop app's local sessions too. New sessions you start afterwards are filed automatically.

Or from your shell:

```bash
claude plugin marketplace add aayushagarwal-dev/claude-sidebar-folder-sections
claude plugin install sidebar-folder-sections@claude-sidebar-folder-sections
```

## Sort the sessions you already have

The plugin only files sessions as they start. To sort your existing ones, open any Code session in Claude Desktop and ask:

> List all my Code sessions, group them by folder (use the git repo root, put worktrees under their repo, home folder → "Home", scratch and /tmp → "Scratch"), create one sidebar section per folder with the ccd_sidebar tools, and move each session into its section.

Claude has the sidebar tools it needs in desktop sessions. `move_sessions` takes up to 100 sessions per call.

## Good to know

- **Sessions started by another session** (for example ones Claude spins off) are nested under that session and always move with it. The app doesn't allow filing them separately, so they stay in their parent's section.
- **Routine runs** show under their routine and can't be grouped.
- Sections are matched **by name**, so two different folders with the same name share a section.
- This relies on the desktop app's sidebar tools (`ccd_sidebar`), which aren't a documented public API. A future app update could change or break them.
- Tested on macOS with Claude Desktop 2.37337.1 and Claude Code 2.1.295. Linux paths are handled; Windows is untested.

## Troubleshooting

Each run appends a line to `~/.claude/sidebar-folder-sections.log` saying what it did (`filed -> my-app`, `nested, follows its parent`, or an error). If a session doesn't land where you expect, look there first.

## Uninstall

```bash
claude plugin uninstall sidebar-folder-sections
```

Your sections stay. Deleting a section in the sidebar moves its sessions back to the main list; nothing is lost.

## License

MIT
