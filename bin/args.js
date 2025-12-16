/**
 * Show usage instructions
 */
export function showUsage() {
  console.log('parquet-grep - Search for text in Apache Parquet files')
  console.log()
  console.log('Usage:')
  console.log('  parquet-grep [options] <query> [parquet-file]')
  console.log()
  console.log('Options:')
  console.log('  -i               Force case-insensitive search')
  console.log('  -v               Invert match (show non-matching rows)')
  // console.log('  -m <n>           Limit matches per file (default: 5, 0 = unlimited)')
  console.log('  --limit <n>      Limit matches per file (default: 5, 0 = unlimited)')
  console.log('  --jsonl          Output in JSONL format')
  console.log('  --table          Output in table format (default)')
  console.log()
  console.log('If no file is specified, recursively searches all .parquet files')
  console.log('in the current directory and subdirectories.')
  console.log()
  console.log('Smart case:')
  console.log('  By default, searches are case-insensitive if the query is all lowercase,')
  console.log('  and case-sensitive if the query contains any uppercase letters.')
}

/**
 * Check if a string contains any uppercase letters
 * @param {string} str
 * @returns {boolean}
 */
function hasUpperCase(str) {
  return /[A-Z]/.test(str)
}

/**
 * Parse command line arguments
 * @param {string[]} args - Array of command line arguments
 * @returns {{query: string, file: string|undefined, caseInsensitive: boolean, viewMode: string, invert: boolean, limit: number}}
 */
export function parseArgs(args) {

  if (!args || args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showUsage()
    process.exit(0)
  }

  // Parse flags
  let forceInsensitive = false
  let invert = false
  let viewMode = 'table' // default to table
  let limit = 5 // default limit
  let i = 0

  // Process all flags
  while (i < args.length) {
    if (args[i] === '-i') {
      forceInsensitive = true
      i++
    } else if (args[i] === '-v') {
      invert = true
      i++
    } else if (args[i] === '-m' || args[i] === '--limit') {
      const limitValue = parseInt(args[i + 1], 10)
      if (isNaN(limitValue) || limitValue < 0) {
        console.error('Error: limit must be a non-negative integer')
        process.exit(1)
      }
      limit = limitValue
      i += 2 // skip both flag and value
    } else if (args[i] === '--jsonl') {
      viewMode = 'jsonl'
      i++
    } else if (args[i] === '--table') {
      viewMode = 'table'
      i++
    } else {
      // First non-flag argument is the query
      break
    }
  }

  const query = args[i]
  const file = args[i + 1]

  // Smart case: if query is all lowercase, search case-insensitively
  // if query has any uppercase, search case-sensitively
  // unless -i is specified, which forces case-insensitive
  const caseInsensitive = forceInsensitive || !hasUpperCase(query)

  if (!query) {
    console.error('Error: query is required')
    showUsage()
    process.exit(1)
  }

  return {
    query,
    file, // may be undefined
    caseInsensitive,
    viewMode,
    invert,
    limit,
  }
}
