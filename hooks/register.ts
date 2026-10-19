import type { Register } from 'claude-code'

// Brings back "group by folder" in the Claude Desktop sidebar's sections layout:
// each new session lands in a section named after its folder (the git repo root
// when there is one), and the section is created if it doesn't exist yet.
// A session is filed once; after that it stays wherever you move it.

const SERVER = 'ccd_sidebar'
const DELAY_MS = 3000

type Section = { id: string; kind: string; name: string }
type Result = { isError: boolean; content: { type: string; text?: string }[] }

const textOf = (r: Result) => r.content.map(b => b.text ?? '').join('')

// Paths are worked on with `/` only; a Windows path (`C:\Users\<name>\...`) is
// turned into `C:/Users/<name>/...` first and handed back with `\` where it
// leaves this file (`exists`, `homeOf`). Windows paths match case-insensitively.

/** The separator `path` is written with: `\` for a Windows path (a backslash or a drive letter), else `/`. */
const sepOf = (path: string) => (path.includes('\\') || /^[A-Za-z]:/.test(path) ? '\\' : '/')
const toSlashes = (path: string) => path.replace(/\\/g, '/')
const toSep = (path: string, sep: string) => (sep === '/' ? path : path.replace(/\//g, sep))

/** `C:/Users/<name>` (any case), `/Users/<name>` or `/home/<name>` at the front of a slashed path. */
const homeIn = (path: string): string | null =>
  path.match(/^[A-Za-z]:\/Users\/[^/]+/i)?.[0] ?? path.match(/^\/(?:Users|home)\/[^/]+/)?.[0] ?? null

/** The home folder at the front of a path, in the path's own separator, else null. */
export const homeOf = (path: string): string | null => {
  const home = homeIn(toSlashes(path))
  return home && toSep(home, sepOf(path))
}

const isScratch = (path: string) =>
  /\/scratch-workspaces\//i.test(path) ||
  /^\/(private\/)?tmp(\/|$)/.test(path) ||
  /^[A-Za-z]:\/(?:Users\/[^/]+\/AppData\/Local\/Temp|Windows\/Temp)(\/|$)/i.test(path)

/** The section a session in `cwd` belongs to. */
export const sectionName = async (cwd: string, exists: (p: string) => Promise<boolean>): Promise<string> => {
  const sep = sepOf(cwd)
  const path = toSlashes(cwd)
  if (!cwd || isScratch(path)) return 'Scratch'

  let dir = path.replace(/\/\.claude\/worktrees\/[^/]+.*$/i, '').replace(/\/+$/, '')
  const home = homeIn(dir)
  if (dir === home) return 'Home'

  // Walk up to the git repo root, never past the home folder.
  for (let q = dir; q.length > (home ?? '').length && q.includes('/'); q = q.slice(0, q.lastIndexOf('/'))) {
    if (await exists(toSep(`${q}/.git`, sep))) {
      dir = q
      break
    }
  }
  return dir.slice(dir.lastIndexOf('/') + 1) || dir
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // %USERPROFILE% on Windows, $HOME elsewhere, else the home folder in the session's path.
    const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || homeOf(e.cwd)
    const logFile = home ? toSep(`${toSlashes(home)}/.claude/sidebar-folder-sections.log`, sepOf(home)) : null

    const log = async (line: string) => {
      if (!logFile) return
      try {
        const prev = (await $.fs.exists(logFile)) ? await $.fs.read(logFile) : ''
        await $.fs.write(logFile, (prev + `${new Date().toISOString()} ${e.cwd} ${line}\n`).slice(-20000))
      } catch {}
    }

    // Deferred so the desktop's sidebar server is ready and the start isn't held up.
    $.clock.after(DELAY_MS, async () => {
      let name = ''
      try {
        const id = await $.session.id()
        if (await $.store.get(`filed:${id}`)) return

        name = await sectionName(e.cwd, p => $.fs.exists(p))
        const listed = await $.mcp.call(SERVER, 'list_sections', {})
        if (listed.isError) return void (await log(`list_sections: ${textOf(listed)}`))

        let section = (JSON.parse(textOf(listed)) as Section[]).find(s => s.kind === 'manual' && s.name === name)
        if (!section) {
          const made = await $.mcp.call(SERVER, 'create_section', { name })
          if (made.isError) return void (await log(`create_section: ${textOf(made)}`))
          section = JSON.parse(textOf(made)) as Section
        }

        const moved = await $.mcp.call(SERVER, 'move_sessions', { session_ids: ['self'], section_id: section.id })
        // A session started by another session is nested under it and moves with it.
        const nested = moved.isError && /nested under/.test(textOf(moved))
        if (!moved.isError || nested) await $.store.set(`filed:${id}`, name)
        await log(`${nested ? 'nested, follows its parent' : moved.isError ? 'move failed' : 'filed'} -> ${name}`)
      } catch (err) {
        // Not a Claude Desktop session (terminal, -p): there is no sidebar to file into.
        await log(`skipped${name ? ` (-> ${name})` : ''}: ${String(err)}`)
      }
    })

    return started
  })
}
