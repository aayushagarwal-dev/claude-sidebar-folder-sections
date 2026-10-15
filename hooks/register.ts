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

/** `/Users/<name>` or `/home/<name>` at the front of a path, else null. */
export const homeOf = (path: string): string | null => path.match(/^\/(?:Users|home)\/[^/]+/)?.[0] ?? null

/** The section a session in `cwd` belongs to. */
export const sectionName = async (cwd: string, exists: (p: string) => Promise<boolean>): Promise<string> => {
  if (!cwd || cwd.includes('/scratch-workspaces/') || /^\/(private\/)?tmp(\/|$)/.test(cwd)) return 'Scratch'

  let dir = cwd.replace(/\/\.claude\/worktrees\/[^/]+.*$/, '').replace(/\/+$/, '')
  const home = homeOf(dir)
  if (dir === home) return 'Home'

  // Walk up to the git repo root, never past the home folder.
  for (let q = dir; q.length > (home ?? '').length && q.includes('/'); q = q.slice(0, q.lastIndexOf('/'))) {
    if (await exists(`${q}/.git`)) {
      dir = q
      break
    }
  }
  return dir.slice(dir.lastIndexOf('/') + 1) || dir
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const home = homeOf(e.cwd)
    const logFile = home ? `${home}/.claude/sidebar-folder-sections.log` : null

    const log = async (line: string) => {
      if (!logFile) return
      try {
        const prev = (await $.fs.exists(logFile)) ? await $.fs.read(logFile) : ''
        await $.fs.write(logFile, (prev + `${new Date().toISOString()} ${e.cwd} ${line}\n`).slice(-20000))
      } catch {}
    }

    // Deferred so the desktop's sidebar server is ready and the start isn't held up.
    $.clock.after(DELAY_MS, async () => {
      try {
        const id = await $.session.id()
        if (await $.store.get(`filed:${id}`)) return

        const name = await sectionName(e.cwd, p => $.fs.exists(p))
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
        await log(`skipped: ${String(err)}`)
      }
    })

    return started
  })
}
