#!/usr/bin/env node
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { parseArgs } from './args.js'
import { formatJsonlOutput, renderMarkdownTable } from './format.js'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Recursively find all .parquet files in a directory
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findParquetFiles(dir) {
  const files = []

  try {
    const entries = await readdir(dir)

    for (const entry of entries) {
      // Skip node_modules and hidden directories
      if (entry === 'node_modules' || entry.startsWith('.')) {
        continue
      }

      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        const subFiles = await findParquetFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.endsWith('.parquet')) {
        files.push(fullPath)
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files
}

/**
 * Check if a row matches the regex pattern
 * @param {object} row
 * @param {RegExp} regex
 * @returns {boolean}
 */
function rowMatches(row, regex) {
  for (const cell of Object.values(row)) {
    if (cell === null || cell === undefined) continue

    // Convert value to string and test against regex
    const stringValue = String(cell)
    if (regex.test(stringValue)) {
      return true
    }
  }
  return false
}

/**
 * Search a single parquet file
 * @param {string} filePath
 * @param {RegExp} regex
 * @returns {Promise<Array<{rowOffset: number, row: object}>>}
 */
async function searchFile(filePath, regex) {
  const matches = []

  try {
    // Read the parquet file
    const file = await asyncBufferFromFile(filePath)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data
    data.forEach((row, index) => {
      if (rowMatches(row, regex)) {
        matches.push({ rowOffset: index, row })
      }
    })
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message)
  }

  return matches
}

/**
 * Main CLI function
 */
async function main() {
  // Detect if we're running via node (e.g., node script.js) or directly (e.g., ./script)
  // If argv[1] contains the script name, we slice(2), otherwise slice(1)
  const argsStart = process.argv[1] && process.argv[1].includes('parquet-grep') ? 2 : 1
  const { query, file: filePath, caseInsensitive, viewMode } = parseArgs(process.argv.slice(argsStart))

  try {
    // Create regex from query with appropriate flags
    const flags = caseInsensitive ? 'i' : ''
    let regex
    try {
      regex = new RegExp(query, flags)
    } catch (error) {
      console.error('Error: Invalid regex pattern:', error.message)
      process.exit(1)
    }

    let files = []

    if (filePath) {
      // Check if the path is a directory or a file
      const stats = await stat(filePath)
      if (stats.isDirectory()) {
        // Search recursively in the specified directory
        files = await findParquetFiles(filePath)
        if (files.length === 0) {
          console.log(`No .parquet files found in ${filePath}`)
          process.exit(0)
        }
      } else {
        // Single file specified
        files = [filePath]
      }
    } else {
      // No file specified, search recursively
      files = await findParquetFiles(process.cwd())

      if (files.length === 0) {
        console.log('No .parquet files found in current directory')
        process.exit(0)
      }
    }

    // Collect all matches grouped by file
    const allMatches = new Map()

    for (const file of files) {
      const matches = await searchFile(file, regex)
      if (matches.length > 0) {
        allMatches.set(file, matches)
      }
    }

    // Output results grouped by file
    if (viewMode === 'jsonl') {
      // JSONL mode: output each match as a JSON line
      for (const [file, matches] of allMatches) {
        for (const { rowOffset, row } of matches) {
          formatJsonlOutput(file, rowOffset, row)
        }
      }
    } else {
      // Table mode: render as markdown tables grouped by file
      for (const [file, matches] of allMatches) {
        renderMarkdownTable(file, matches)
      }
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
