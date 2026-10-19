import { test, expect } from 'claude-code/testing'
import { homeOf, sectionName } from '../hooks/register'

const repos = new Set(['/Users/sam/api-server/.git', '/home/kim/site/.git'])
const exists = async (p: string) => repos.has(p)

test('finds the home folder on macOS and Linux', () => {
  expect(homeOf('/Users/sam/code/x')).toBe('/Users/sam')
  expect(homeOf('/home/kim')).toBe('/home/kim')
  expect(homeOf('/opt/work')).toBe(null)
})

test('names the section after the git repo root, worktrees included', async () => {
  expect(await sectionName('/Users/sam/api-server/src/routes', exists)).toBe('api-server')
  expect(await sectionName('/Users/sam/api-server/.claude/worktrees/fix-123', exists)).toBe('api-server')
  expect(await sectionName('/home/kim/site/docs', exists)).toBe('site')
})

test('falls back to the folder itself, Home and Scratch', async () => {
  expect(await sectionName('/Users/sam/notes', exists)).toBe('notes')
  expect(await sectionName('/Users/sam', exists)).toBe('Home')
  expect(await sectionName('/private/tmp/x', exists)).toBe('Scratch')
  expect(await sectionName('/Users/sam/Library/Application Support/Claude/scratch-workspaces/a/b', exists)).toBe('Scratch')
  expect(await sectionName('/opt/work/thing', exists)).toBe('thing')
})

// Windows file systems ignore case, so this one does too.
const winRepos = new Set(['C:\\Users\\sam\\api-server\\.git', 'C:\\Users\\sam\\.git', 'D:\\work\\tool\\.git'].map(p => p.toLowerCase()))
const winExists = async (p: string) => winRepos.has(p.toLowerCase())

test('finds the home folder on Windows', () => {
  expect(homeOf('C:\\Users\\sam\\code\\x')).toBe('C:\\Users\\sam')
  expect(homeOf('c:\\users\\Sam')).toBe('c:\\users\\Sam')
  expect(homeOf('C:/Users/sam/code')).toBe('C:\\Users\\sam')
  expect(homeOf('D:\\work')).toBe(null)
})

test('names the section after the git repo root on Windows, worktrees included', async () => {
  expect(await sectionName('C:\\Users\\sam\\api-server\\src\\routes', winExists)).toBe('api-server')
  expect(await sectionName('c:\\users\\sam\\API-Server\\src', winExists)).toBe('API-Server')
  expect(await sectionName('C:\\Users\\sam\\api-server\\.claude\\worktrees\\fix-123', winExists)).toBe('api-server')
  expect(await sectionName('C:\\Users\\sam\\api-server\\.Claude\\Worktrees\\fix-123\\src', winExists)).toBe('api-server')
  expect(await sectionName('C:/Users/sam/api-server/src', winExists)).toBe('api-server')
  expect(await sectionName('D:\\work\\tool\\lib\\', winExists)).toBe('tool')
})

test('asks for .git with backslashes on Windows', async () => {
  const asked: string[] = []
  await sectionName('C:\\Users\\sam\\notes\\sub', async p => (asked.push(p), false))
  expect(asked).toEqual(['C:\\Users\\sam\\notes\\sub\\.git', 'C:\\Users\\sam\\notes\\.git'])
})

test('falls back to the folder itself, Home and Scratch on Windows', async () => {
  // A repo in the home folder itself (dotfiles) never swallows the folders below it.
  expect(await sectionName('C:\\Users\\sam\\notes', winExists)).toBe('notes')
  expect(await sectionName('c:\\users\\sam\\notes', winExists)).toBe('notes')
  expect(await sectionName('C:\\Users\\sam', winExists)).toBe('Home')
  expect(await sectionName('C:\\Users\\sam\\', winExists)).toBe('Home')
  expect(await sectionName('c:\\USERS\\sam', winExists)).toBe('Home')
  expect(await sectionName('C:\\Users\\sam\\AppData\\Local\\Temp\\claude\\x', winExists)).toBe('Scratch')
  expect(await sectionName('C:\\Users\\DANIEL~1.EMM\\AppData\\Local\\Temp', winExists)).toBe('Scratch')
  expect(await sectionName('c:\\users\\sam\\appdata\\local\\temp\\y', winExists)).toBe('Scratch')
  expect(await sectionName('C:\\Windows\\Temp\\z', winExists)).toBe('Scratch')
  expect(await sectionName('C:\\Users\\sam\\AppData\\Roaming\\Claude\\scratch-workspaces\\a\\b', winExists)).toBe('Scratch')
  expect(await sectionName('C:\\Users\\sam\\AppData\\Local\\Templates\\x', winExists)).toBe('x')
  expect(await sectionName('D:\\work\\thing', winExists)).toBe('thing')
})
