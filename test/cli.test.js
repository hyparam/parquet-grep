import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const CLI_PATH = join(process.cwd(), 'bin/parquet-grep.js')
const TEST_FILE = join(process.cwd(), 'test/files/bunnies.parquet')
const TEST_DIR = join(process.cwd(), 'test/files')

/**
 * @param {string} args
 * @param {{ cwd?: string }} [options]
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
      exitCode: error.status
    }
  }
}

describe('CLI integration tests', () => {
  describe('single file search', () => {
    it('should find matches in a single file', () => {
      const { stdout } = runCLI(`lop ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
      expect(stdout).toContain('Row 0:')
      expect(stdout).not.toContain('test/files/bunnies.parquet')
    })

    it('should show "No matches found" when nothing matches', () => {
      const { stdout } = runCLI(`nonexistent ${TEST_FILE}`)
      expect(stdout).toContain('No matches found')
    })

    it('should search case-insensitively for lowercase query', () => {
      const { stdout } = runCLI(`holland ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should search case-sensitively for mixed case query', () => {
      const { stdout } = runCLI(`Holland ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })

    it('should not find lowercase when searching case-sensitively', () => {
      const { stdout } = runCLI(`HOLLAND ${TEST_FILE}`)
      expect(stdout).toContain('No matches found')
    })

    it('should force case-insensitive search with -i flag', () => {
      const { stdout } = runCLI(`-i HOLLAND ${TEST_FILE}`)
      expect(stdout).toContain('Holland Lop')
    })
  })

  describe('recursive search', () => {
    it('should find matches in multiple files recursively', () => {
      const { stdout } = runCLI('lop', { cwd: TEST_DIR })
      expect(stdout).toContain('bunnies.parquet:')
      expect(stdout).toContain('more-bunnies.parquet:')
      expect(stdout).toContain('Holland Lop')
    })

    it('should show filename prefix in recursive mode', () => {
      const { stdout } = runCLI('lop', { cwd: TEST_DIR })
      expect(stdout).toMatch(/\.parquet:\d+:/)
    })

    it('should handle -i flag in recursive mode', () => {
      const { stdout } = runCLI('-i HOLLAND', { cwd: TEST_DIR })
      expect(stdout).toContain('Holland Lop')
      expect(stdout).toContain('.parquet:')
    })

    it('should show "No matches found" when nothing matches recursively', () => {
      const { stdout } = runCLI('nonexistent', { cwd: TEST_DIR })
      expect(stdout).toContain('No matches found')
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
