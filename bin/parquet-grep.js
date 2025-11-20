#!/usr/bin/env node
import { asyncBufferFromFile, parquetReadObjects, toJson } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { parseArgs } from './args.js'
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
 * Check if a row contains the query string
 * @param {object} row
 * @param {string} query
 * @param {boolean} caseInsensitive
 * @returns {boolean}
 */
function rowMatches(row, query, caseInsensitive) {
  const searchQuery = caseInsensitive ? query.toLowerCase() : query

  for (const cell of Object.values(row)) {
    if (cell === null || cell === undefined) continue

    // Convert value to string and check if it contains the query
    let stringValue = String(cell)
    if (caseInsensitive) {
      stringValue = stringValue.toLowerCase()
    }

    if (stringValue.includes(searchQuery)) {
      return true
    }
  }
  return false
}

/**
 * Escape pipe characters for markdown table cells
 * @param {any} value
 * @returns {string}
 */
function escapeMarkdownCell(value) {
  if (value === null || value === undefined) {
    return 'null'
  }
  const str = typeof value === 'bigint' ? value.toString() : JSON.stringify(value)
  // Escape pipe characters and remove quotes for cleaner display
  return str.replace(/\|/g, '\\|').replace(/^"(.*)"$/, '$1')
}

/**
 * Render matches as a markdown table
 * @param {string} filePath
 * @param {Array<{rowOffset: number, row: object}>} matches
 */
function renderMarkdownTable(filePath, matches) {
  if (matches.length === 0) return

  // Print file header
  console.log(`## ${filePath}\n`)

  // Get all column names from the first match
  const columns = Object.keys(matches[0].row)

  // Print table header
  console.log(`| Row | ${columns.join(' | ')} |`)
  console.log(`|-----|${columns.map(() => '-----').join('|')}|`)

  // Print each row
  for (const { rowOffset, row } of matches) {
    const cells = columns.map(col => escapeMarkdownCell(row[col]))
    console.log(`| ${rowOffset} | ${cells.join(' | ')} |`)
  }

  console.log() // Empty line after table
}

/**
 * Format output for JSONL mode
 * @param {string} filePath
 * @param {number} rowOffset
 * @param {object} row
 */
function formatJsonlOutput(filePath, rowOffset, row) {
  const output = {
    filename: filePath,
    rowOffset,
    value: row,
  }
  console.log(JSON.stringify(toJson(output)))
}

/**
 * Search a single parquet file
 * @param {string} filePath
 * @param {string} query
 * @param {boolean} caseInsensitive
 * @returns {Promise<Array<{rowOffset: number, row: object}>>}
 */
async function searchFile(filePath, query, caseInsensitive) {
  const matches = []

  try {
    // Read the parquet file
    const file = await asyncBufferFromFile(filePath)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data
    data.forEach((row, index) => {
      if (rowMatches(row, query, caseInsensitive)) {
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
    let files = []

    if (filePath) {
      // Single file specified
      files = [filePath]
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
      const matches = await searchFile(file, query, caseInsensitive)
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
