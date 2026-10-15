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
