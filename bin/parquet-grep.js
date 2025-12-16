#!/usr/bin/env node
import { asyncBufferFromFile, asyncBufferFromUrl, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { parseArgs } from './args.js'
import { formatJsonlOutput, renderMarkdownTable } from './format.js'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Check if a string is a URL
 * @param {string} str
 * @returns {boolean}
 */
function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://')
}

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
 * Search a single parquet file (local or URL)
 * @param {string} filename
 * @param {RegExp} regex
 * @param {boolean} invert - If true, return non-matching rows
 * @param {number} limit - Maximum matches to collect per file (0 = unlimited)
 * @param {number} offset - Number of matches to skip per file
 * @returns {Promise<Array<{rowOffset: number, row: object, regex: RegExp}>>}
 */
async function searchFile(filename, regex, invert, limit, offset) {
  /** @type {Array<{rowOffset: number, row: object, regex: RegExp}>} */
  const matches = []

  try {
    // Read the parquet file (local or URL)
    const file = isUrl(filename)
      ? await asyncBufferFromUrl({ url: filename })
      : await asyncBufferFromFile(filename)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data with limit check
    for (let index = 0; index < data.length; index++) {
      const row = data[index]
      const isMatch = rowMatches(row, regex)
      if (invert ? !isMatch : isMatch) {
        matches.push({ rowOffset: index, row, regex })

        // Stop if we've collected offset + limit + 1 matches
        if (limit > 0 && matches.length > offset + limit) {
          break
        }
      }
    }
  } catch (/** @type {any} */ error) {
    console.error(`Error reading ${filename}:`, error.message)
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
  const { query, file: filePath, caseInsensitive, viewMode, invert, limit, offset } = parseArgs(process.argv.slice(argsStart))

  try {
    // Create regex from query with appropriate flags
    const flags = caseInsensitive ? 'i' : ''
    let regex
    try {
      regex = new RegExp(query, flags)
    } catch (/** @type {any} */ error) {
      console.error('Error: Invalid regex pattern:', error.message)
      process.exit(1)
    }

    let files = []

    if (filePath) {
      if (isUrl(filePath)) {
        // URL specified - treat as single file
        files = [filePath]
      } else {
        // Local path - check if it's a directory or file
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
      const matches = await searchFile(file, regex, invert, limit, offset)
      if (matches.length > 0) {
        allMatches.set(file, matches)
      }
    }

    // Output results grouped by file
    if (viewMode === 'jsonl') {
      // JSONL mode: output each match as a JSON line
      for (const [filename, matches] of allMatches) {
        const limitExceeded = limit > 0 && matches.length > offset + limit
        const matchesToDisplay = limit > 0
          ? matches.slice(offset, offset + limit)
          : matches.slice(offset)

        for (const { rowOffset, row, regex } of matchesToDisplay) {
          formatJsonlOutput({ filename, rowOffset, row, regex, invert })
        }

        if (limitExceeded) {
          console.log('...')
        }
      }
    } else {
      // Table mode: render as markdown tables grouped by file
      for (const [file, matches] of allMatches) {
        const limitExceeded = limit > 0 && matches.length > offset + limit
        const matchesToDisplay = limit > 0
          ? matches.slice(offset, offset + limit)
          : matches.slice(offset)

        renderMarkdownTable(file, matchesToDisplay, invert)

        if (limitExceeded) {
          console.log('...')
        }
      }
    }
  } catch (/** @type {any} */ error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
