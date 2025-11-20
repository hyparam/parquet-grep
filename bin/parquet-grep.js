#!/usr/bin/env node
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { parseArgs } from '../args.js'

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
 * Main CLI function
 */
async function main() {
  const { query, file: filePath, caseInsensitive } = parseArgs()

  try {
    // Read the parquet file
    const file = await asyncBufferFromFile(filePath)
    const data = await parquetReadObjects({ file, compressors })

    // Grep through the data
    let matchCount = 0
    data.forEach((row, index) => {
      if (rowMatches(row, query, caseInsensitive)) {
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
