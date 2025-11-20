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
      const { stdout } = runCLI('--jsonl lop', { cwd: TEST_DIR })
      expect(stdout).toContain('bunnies.parquet')
      expect(stdout).toContain('more-bunnies.parquet')
      expect(stdout).toContain('Holland Lop')
    })

    it('should show filename in JSONL output', () => {
      const { stdout } = runCLI('--jsonl lop', { cwd: TEST_DIR })
      expect(stdout).toContain('"filename"')
      expect(stdout).toContain('"rowOffset"')
    })

    it('should handle -i flag in recursive mode', () => {
      const { stdout } = runCLI('--jsonl -i HOLLAND', { cwd: TEST_DIR })
      expect(stdout).toContain('Holland Lop')
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
  })
})
