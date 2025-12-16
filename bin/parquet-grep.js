#!/usr/bin/env node
import { isUrl, parseArgs } from './args.js'
import { formatJsonlOutput, renderMarkdownTable } from './format.js'
import { searchFile } from './seachFiles.js'
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
 * Main CLI function
 */
async function main() {
  // Detect if we're running via node (e.g., node script.js) or directly (e.g., ./script)
  // If argv[1] contains the script name, we slice(2), otherwise slice(1)
  const argsStart = process.argv[1] && process.argv[1].includes('parquet-grep') ? 2 : 1
  const {
    query, file, caseInsensitive, viewMode, invert, limit, offset,
  } = parseArgs(process.argv.slice(argsStart))

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

    if (file) {
      if (isUrl(file)) {
        // URL specified - treat as single file
        files = [file]
      } else {
        // Local path - check if it's a directory or file
        const stats = await stat(file)
        if (stats.isDirectory()) {
          // Search recursively in the specified directory
          files = await findParquetFiles(file)
          if (files.length === 0) {
            console.log(`No .parquet files found in ${file}`)
            process.exit(0)
          }
        } else {
          // Single file specified
          files = [file]
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

    // Process files and stream results
    for (const file of files) {
      let skipped = 0
      let displayed = 0
      let limitExceeded = false
      /** @type {Array<{rowOffset: number, row: object, regex: RegExp}>} */
      const fileMatches = []

      try {
        for await (const match of searchFile(file, regex, invert)) {
          // Skip matches until we've passed the offset
          if (skipped < offset) {
            skipped++
            continue
          }

          // Check if we've hit the limit
          if (limit > 0 && displayed >= limit) {
            limitExceeded = true
            break
          }

          displayed++

          if (viewMode === 'jsonl') {
            // JSONL mode: stream each match immediately
            formatJsonlOutput({ filename: file, rowOffset: match.rowOffset, row: match.row, regex: match.regex, invert })
          } else {
            // Table mode: collect matches for this file
            fileMatches.push(match)
          }
        }
      } catch (/** @type {any} */ error) {
        console.error(`Error reading ${file}:`, error.message)
        continue
      }

      // Table mode: render collected matches for this file
      if (viewMode !== 'jsonl' && fileMatches.length > 0) {
        renderMarkdownTable(file, fileMatches, invert)
      }

      if (limitExceeded) {
        console.log('...')
      }
    }
  } catch (/** @type {any} */ error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
