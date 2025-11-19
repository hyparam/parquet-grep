#!/usr/bin/env node
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'

/**
 * Show usage instructions
 */
function showUsage() {
  console.log('parquet-grep - Search for text in Apache Parquet files')
  console.log()
  console.log('Usage:')
  console.log('  parquet-grep <query> <parquet-file>')
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showUsage()
    process.exit(0)
  }

  return {
    query: args[0],
    file: args[1],
  }
}

/**
 * Check if a row contains the query string
 */
function rowMatches(row, query) {
  for (const cell of Object.values(row)) {
    if (cell === null || cell === undefined) continue

    // Convert value to string and check if it contains the query
    const stringValue = String(cell)
    if (stringValue.includes(query)) {
      return true
    }
  }
  return false
}

/**
 * Main CLI function
 */
async function main() {
  const { query, file: filePath } = parseArgs()

  try {
    // Read the parquet file
    const file = await asyncBufferFromFile(filePath)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data
    let matchCount = 0
    data.forEach((row, index) => {
      if (rowMatches(row, query)) {
        console.log(`Row ${index}:`, row)
        matchCount++
      }
    })

    if (matchCount === 0) {
      console.log('No matches found')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
