import { toJson } from 'hyparquet'

/**
 * Check if output should be colorized
 * @returns {boolean}
 */
function shouldColorize() {
  // Only colorize if outputting to a TTY (terminal)
  // This avoids adding ANSI codes when piping or redirecting output
  return process.stdout.isTTY === true
}

/**
 * Highlight all matches in a string with ANSI color codes
 * @param {string} text
 * @param {RegExp} regex
 * @param {boolean} invert - If true, don't highlight (used for inverted matches)
 * @returns {string}
 */
function highlightMatches(text, regex, invert) {
  if (invert || !regex || !shouldColorize()) return text

  // Use reverse video (inverted colors) for highlighting
  const highlightStart = '\x1b[7m'
  const highlightEnd = '\x1b[27m'

  // Create a global version of the regex to find all matches
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')

  return text.replace(globalRegex, match => `${highlightStart}${match}${highlightEnd}`)
}

/**
 * Escape pipe characters for markdown table cells
 * @param {any} value
 * @param {RegExp} regex
 * @param {boolean} invert
 * @returns {string}
 */
function escapeMarkdownCell(value, regex, invert) {
  if (value === null || value === undefined) {
    return 'null'
  }
  const str = typeof value === 'bigint' ? value.toString() : JSON.stringify(value)
  // Remove quotes for cleaner display
  const cleanStr = str.replace(/^"(.*)"$/, '$1')

  // Highlight matches if regex provided
  const highlighted = regex ? highlightMatches(cleanStr, regex, invert) : cleanStr

  // Escape pipe characters
  return highlighted.replace(/\|/g, '\\|')
}

/**
 * Render matches as a markdown table
 * @param {string} filePath
 * @param {Array<{rowOffset: number, row: Record<string, any>, regex: RegExp}>} matches
 * @param {boolean} invert - If true, don't highlight (inverted matches)
 */
export function renderMarkdownTable(filePath, matches, invert) {
  if (matches.length === 0) return

  // Print file header
  console.log(`## ${filePath}\n`)

  // Get all column names from the first match
  const { row, regex } = matches[0]
  const columns = Object.keys(row)

  // Print table header
  console.log(`| Row | ${columns.join(' | ')} |`)
  console.log(`|-----|${columns.map(() => '-----').join('|')}|`)

  // Print each row
  for (const { rowOffset, row } of matches) {
    const cells = columns.map(col => escapeMarkdownCell(row[col], regex, invert))
    console.log(`| ${rowOffset} | ${cells.join(' | ')} |`)
  }

  console.log() // Empty line after table
}

/**
 * Highlight matches in an object's values recursively
 * @param {any} obj
 * @param {RegExp} regex
 * @param {boolean} invert
 * @returns {any}
 */
function highlightObject(obj, regex, invert) {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return highlightMatches(obj, regex, invert)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => highlightObject(item, regex, invert))
  }

  if (typeof obj === 'object') {
    /** @type {Record<string, any>} */
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = highlightObject(value, regex, invert)
    }
    return result
  }

  return obj
}

/**
 * Format output for JSONL mode
 * @param {object} options
 * @param {string} options.filename
 * @param {number} options.rowOffset
 * @param {object} options.row
 * @param {RegExp} options.regex
 * @param {boolean} options.invert
 */
export function formatJsonlOutput({ filename, rowOffset, row, regex, invert }) {
  const highlightedRow = regex && !invert ? highlightObject(row, regex, invert) : row
  const output = {
    filename,
    rowOffset,
    value: highlightedRow,
  }
  console.log(JSON.stringify(toJson(output)))
}
