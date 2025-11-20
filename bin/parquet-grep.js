#!/usr/bin/env node
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { parseArgs } from './args.js'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Recursively find all .parquet files in a directory
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
  } catch (error) {
    // Skip directories we can't read
  }

  return files
}

/**
 * Check if a row contains the query string
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
 * Search a single parquet file
 */
async function searchFile(filePath, query, caseInsensitive, showFileName) {
  let matchCount = 0

  try {
    // Read the parquet file
    const file = await asyncBufferFromFile(filePath)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data
    data.forEach((row, index) => {
      if (rowMatches(row, query, caseInsensitive)) {
        if (showFileName) {
          console.log(`${filePath}:${index}:`, row)
        } else {
          console.log(`Row ${index}:`, row)
        }
        matchCount++
      }
    })
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message)
  }

  return matchCount
}

/**
 * Main CLI function
 */
async function main() {
  // Detect if we're running via node (e.g., node script.js) or directly (e.g., ./script)
  // If argv[1] contains the script name, we slice(2), otherwise slice(1)
  const argsStart = process.argv[1] && process.argv[1].includes('parquet-grep') ? 2 : 1
  const { query, file: filePath, caseInsensitive } = parseArgs(process.argv.slice(argsStart))

  try {
    let files = []
    let showFileName = false

    if (filePath) {
      // Single file specified
      files = [filePath]
    } else {
      // No file specified, search recursively
      files = await findParquetFiles(process.cwd())
      showFileName = true

      if (files.length === 0) {
        console.log('No .parquet files found in current directory')
        process.exit(0)
      }
    }

    // Search all files
    let totalMatches = 0
    for (const file of files) {
      const matches = await searchFile(file, query, caseInsensitive, showFileName)
      totalMatches += matches
    }

    if (totalMatches === 0) {
      console.log('No matches found')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
