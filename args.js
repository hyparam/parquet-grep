/**
 * Show usage instructions
 */
export function showUsage() {
  console.log('parquet-grep - Search for text in Apache Parquet files')
  console.log()
  console.log('Usage:')
  console.log('  parquet-grep [options] <query> <parquet-file>')
  console.log()
  console.log('Options:')
  console.log('  -i               Force case-insensitive search')
  console.log()
  console.log('Smart case:')
  console.log('  By default, searches are case-insensitive if the query is all lowercase,')
  console.log('  and case-sensitive if the query contains any uppercase letters.')
}

/**
 * Check if a string contains any uppercase letters
 */
function hasUpperCase(str) {
  return /[A-Z]/.test(str)
}

/**
 * Parse command line arguments
 */
export function parseArgs() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showUsage()
    process.exit(0)
  }

  // Check for -i flag
  let forceInsensitive = false
  let query, file

  if (args[0] === '-i') {
    forceInsensitive = true
    query = args[1]
    file = args[2]
  } else {
    query = args[0]
    file = args[1]
  }

  // Smart case: if query is all lowercase, search case-insensitively
  // if query has any uppercase, search case-sensitively
  // unless -i is specified, which forces case-insensitive
  const caseInsensitive = forceInsensitive || !hasUpperCase(query)

  return {
    query,
    file,
    caseInsensitive,
  }
}
