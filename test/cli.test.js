import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const CLI_PATH = join(process.cwd(), 'bin/parquet-grep.js')
const TEST_FILE = join(process.cwd(), 'test/files/bunnies.parquet')
const TEST_DIR = join(process.cwd(), 'test/files')

/**
 * @param {string} args
 * @param {{ cwd?: string }} [options]
 * @returns {{stdout: string, stderr?: string, exitCode: number}}
 */
function runCLI(args, options = {}) {
  try {
    const result = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf8',
      cwd: options.cwd || process.cwd(),
    })
    return { stdout: result, exitCode: 0 }
  } catch (/** @type {any} */ error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status,
    }
  }
}

describe('CLI integration tests', () => {
  describe('single file search', () => {
    it('should find matches in a single file', () => {
      const { stdout } = runCLI(`--jsonl lop ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
      expect(stdout).toContain('"rowOffset":0')
      expect(stdout).toContain('bunnies.parquet')
    })

    it('should not output anything when nothing matches', () => {
      const { stdout } = runCLI(`--jsonl nonexistent ${TEST_FILE}`)
      expect(stdout).toBe('')
    })

    it('should search case-insensitively for lowercase query', () => {
      const { stdout } = runCLI(`--jsonl holland ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should search case-sensitively for mixed case query', () => {
      const { stdout } = runCLI(`--jsonl Holland ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should not find lowercase when searching case-sensitively', () => {
      const { stdout } = runCLI(`--jsonl HOLLAND ${TEST_FILE}`)
      expect(stdout).toBe('')
    })

    it('should force case-insensitive search with -i flag', () => {
      const { stdout } = runCLI(`--jsonl -i HOLLAND ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })
  })

  describe('recursive search', () => {
    it('should find matches in multiple files recursively', () => {
      const { stdout } = runCLI('--jsonl pork', { cwd: TEST_DIR })
      expect(stdout).toContain('tacos.parquet')
      expect(stdout).toContain('pork')
    })

    it('should show filename in JSONL output', () => {
      const { stdout } = runCLI('--jsonl lop', { cwd: TEST_DIR })
      expect(stdout).toContain('"filename"')
      expect(stdout).toContain('"rowOffset"')
    })

    it('should handle -i flag in recursive mode', () => {
      const { stdout } = runCLI('--jsonl -i ASADA', { cwd: TEST_DIR })
      expect(stdout).toContain('Asada')
      expect(stdout).toContain('.parquet')
    })

    it('should not output anything when nothing matches recursively', () => {
      const { stdout } = runCLI('--jsonl nonexistent', { cwd: TEST_DIR })
      expect(stdout).toBe('')
    })
  })

  describe('regex patterns', () => {
    it('should support basic regex patterns', () => {
      const { stdout } = runCLI(`--jsonl "Hol+and" ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should support character classes', () => {
      const { stdout } = runCLI(`--jsonl "[Hh]olland" ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should support anchors', () => {
      const { stdout } = runCLI(`--jsonl "^Holland" ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should support alternation', () => {
      const { stdout } = runCLI(`--jsonl "Holland|Dwarf" ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should respect case sensitivity with regex', () => {
      const { stdout } = runCLI(`--jsonl "HOLLAND" ${TEST_FILE}`)
      expect(stdout).toBe('')
    })

    it('should support case insensitive regex with -i flag', () => {
      const { stdout } = runCLI(`--jsonl -i "HOLL[A-Z]+" ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should handle invalid regex gracefully', () => {
      const { stderr, exitCode } = runCLI(`--jsonl "[unclosed" ${TEST_FILE}`)
      expect(stderr).toContain('Invalid regex pattern')
      expect(exitCode).toBe(1)
    })
  })

  describe('invert match (-v flag)', () => {
    it('should return rows that do NOT match the pattern', () => {
      const { stdout } = runCLI(`--jsonl -v lop ${TEST_FILE}`)
      // Should not contain Holland Lop row
      expect(stdout).not.toContain('Holland Lop')
      // Should contain other rows that don't have "lop"
      expect(stdout).toContain('"rowOffset"')
    })

    it('should work with case-insensitive search', () => {
      const { stdout } = runCLI(`--jsonl -v -i HOLLAND ${TEST_FILE}`)
      // Should not contain Holland Lop row
      expect(stdout).not.toContain('Holland')
      // Should contain other rows
      expect(stdout).toContain('"rowOffset"')
    })

    it('should return all rows when pattern matches nothing (inverted)', () => {
      const { stdout } = runCLI(`--jsonl -v nonexistent ${TEST_FILE}`)
      // When inverting a pattern that matches nothing, all rows should be returned
      expect(stdout).toContain('"rowOffset"')
      expect(stdout.split('\n').filter(line => line.trim()).length).toBeGreaterThan(0)
    })

    it('should return nothing when pattern matches everything (inverted)', () => {
      // Using a pattern that matches any character
      const { stdout } = runCLI(`--jsonl -v "." ${TEST_FILE}`)
      // When inverting a pattern that matches everything, nothing should be returned
      // (every row has some non-null value)
      expect(stdout).toBe('')
    })
  })

  describe('limit flag (-m / --limit)', () => {
    it('should limit results with -m flag', () => {
      const { stdout } = runCLI(`--jsonl -m 2 "." ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line && !line.startsWith('...'))
      expect(lines.length).toBe(2)
    })

    it('should show ... when limit is exceeded', () => {
      const { stdout } = runCLI(`-m 2 "." ${TEST_FILE}`)
      expect(stdout).toContain('...')
    })

    it('should work with --limit flag', () => {
      const { stdout } = runCLI(`--jsonl --limit 3 "." ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line && !line.startsWith('...'))
      expect(lines.length).toBe(3)
    })

    it('should allow unlimited with -m 0', () => {
      const { stdout } = runCLI(`--jsonl -m 0 "lop" ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line)
      expect(lines.length).toBeGreaterThan(5)
    })

    it('should not show ... when matches equal limit', () => {
      const { stdout } = runCLI(`-m 100 "lop" ${TEST_FILE}`)
      expect(stdout).not.toContain('...')
    })

    it('should reject negative limit', () => {
      const { stderr, exitCode } = runCLI(`-m -1 "test" ${TEST_FILE}`)
      expect(stderr).toContain('limit must be a non-negative integer')
      expect(exitCode).toBe(1)
    })

    it('should reject non-numeric limit', () => {
      const { stderr, exitCode } = runCLI(`-m abc "test" ${TEST_FILE}`)
      expect(stderr).toContain('limit must be a non-negative integer')
      expect(exitCode).toBe(1)
    })
  })

  describe('offset flag (--offset)', () => {
    it('should skip first N matches with --offset', () => {
      const { stdout } = runCLI(`--jsonl --offset 1 "." ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line && !line.startsWith('...'))
      // Parse the first line to check it doesn't have rowOffset:0
      const firstMatch = JSON.parse(lines[0])
      expect(firstMatch.rowOffset).not.toBe(0)
    })

    it('should combine offset with limit', () => {
      const { stdout } = runCLI(`--jsonl --offset 1 --limit 2 "." ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line && !line.startsWith('...'))
      expect(lines.length).toBe(2)
      // First line should be rowOffset:1 (skipping rowOffset:0)
      const firstMatch = JSON.parse(lines[0])
      expect(firstMatch.rowOffset).toBe(1)
    })

    it('should show ... when there are more matches beyond offset+limit', () => {
      const { stdout } = runCLI(`--offset 1 --limit 2 "." ${TEST_FILE}`)
      expect(stdout).toContain('...')
    })

    it('should not show ... when offset+limit >= total matches', () => {
      const { stdout } = runCLI(`--offset 1 --limit 100 "lop" ${TEST_FILE}`)
      expect(stdout).not.toContain('...')
    })

    it('should work with offset larger than total matches', () => {
      const { stdout } = runCLI(`--jsonl --offset 100 "lop" ${TEST_FILE}`)
      expect(stdout).toBe('')
    })

    it('should work with offset=0 (same as no offset)', () => {
      const { stdout: withoutOffset } = runCLI(`--jsonl --limit 3 "." ${TEST_FILE}`)
      const { stdout: withOffset } = runCLI(`--jsonl --offset 0 --limit 3 "." ${TEST_FILE}`)
      expect(withOffset).toBe(withoutOffset)
    })

    it('should work with unlimited mode (--limit 0)', () => {
      const { stdout } = runCLI(`--jsonl --offset 1 --limit 0 "lop" ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line)
      // Should have all matches except the first one
      expect(lines.length).toBeGreaterThan(0)
      const firstMatch = JSON.parse(lines[0])
      expect(firstMatch.rowOffset).not.toBe(0)
    })

    it('should work in table mode', () => {
      const { stdout } = runCLI(`--offset 1 --limit 2 "." ${TEST_FILE}`)
      // Should show results and not contain rowOffset:0
      expect(stdout).toContain('bunnies.parquet')
      expect(stdout).not.toContain(':0')
    })

    it('should work with -i flag', () => {
      const { stdout } = runCLI(`--jsonl -i --offset 1 "HOLLAND" ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line)
      if (lines.length > 0) {
        const firstMatch = JSON.parse(lines[0])
        expect(firstMatch.rowOffset).not.toBe(0)
      }
    })

    it('should work with -v flag (invert)', () => {
      const { stdout } = runCLI(`--jsonl -v --offset 1 --limit 2 "lop" ${TEST_FILE}`)
      const lines = stdout.trim().split('\n').filter(line => line && !line.startsWith('...'))
      expect(lines.length).toBe(2)
      // Should skip first non-matching row
      const firstMatch = JSON.parse(lines[0])
      expect(firstMatch.rowOffset).toBeGreaterThan(0)
    })

    it('should reject negative offset', () => {
      const { stderr, exitCode } = runCLI(`--offset -1 "test" ${TEST_FILE}`)
      expect(stderr).toContain('offset must be a non-negative integer')
      expect(exitCode).toBe(1)
    })

    it('should reject non-numeric offset', () => {
      const { stderr, exitCode } = runCLI(`--offset abc "test" ${TEST_FILE}`)
      expect(stderr).toContain('offset must be a non-negative integer')
      expect(exitCode).toBe(1)
    })
  })

  describe('help and error handling', () => {
    it('should show help with --help', () => {
      const { stdout, exitCode } = runCLI('--help')
      expect(stdout).toContain('parquet-grep')
      expect(stdout).toContain('Usage:')
      expect(exitCode).toBe(0)
    })

    it('should show help with -h', () => {
      const { stdout, exitCode } = runCLI('-h')
      expect(stdout).toContain('parquet-grep')
      expect(exitCode).toBe(0)
    })

    it('should mention recursive search in help', () => {
      const { stdout } = runCLI('--help')
      expect(stdout).toContain('recursively')
    })

    it('should mention -v flag in help', () => {
      const { stdout } = runCLI('--help')
      expect(stdout).toContain('-v')
      expect(stdout).toContain('Invert')
    })

    it('should mention --limit flag in help', () => {
      const { stdout } = runCLI('--help')
      expect(stdout).toContain('--limit')
      expect(stdout).toContain('Limit')
    })

    it('should mention --offset flag in help', () => {
      const { stdout } = runCLI('--help')
      expect(stdout).toContain('--offset')
      expect(stdout).toContain('Skip')
    })
  })
})
