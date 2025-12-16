import { toJson } from 'hyparquet'

/**
 * Trim text to show context around the first match
 * @param {string} text - The text to trim
 * @param {RegExp} regex - The regex to find the match
 * @param {number} maxLength - Maximum length of output (0 = no trim)
 * @returns {string}
 */
function trimToContext(text, regex, maxLength) {
  if (maxLength <= 0 || text.length <= maxLength) {
    return text
  }

  // Find the first match
  const match = text.match(regex)
  if (!match || match.index === undefined) {
    // No match found, just truncate from the start
    return text.slice(0, maxLength - 3) + '...'
  }

  const matchStart = match.index
  const matchEnd = matchStart + match[0].length

  // Calculate how much context we can show around the match
  const availableSpace = maxLength - match[0].length
  const contextEach = Math.floor(availableSpace / 2)

  // Calculate start and end positions
  let start = Math.max(0, matchStart - contextEach)
  let end = Math.min(text.length, matchEnd + contextEach)

  // Adjust if we're near the beginning or end
  if (start === 0) {
    end = Math.min(text.length, maxLength - 3)
  } else if (end === text.length) {
    start = Math.max(0, text.length - maxLength + 3)
  }

  // Build the result with ellipses
  let result = text.slice(start, end)
  if (start > 0) {
    result = '...' + result
  }
  if (end < text.length) {
    result = result + '...'
  }

  return result
}

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
 * @param {number} trim - Maximum length of text (0 = no trim)
 * @returns {string}
 */
function escapeMarkdownCell(value, regex, invert, trim) {
  if (value === null || value === undefined) {
    return 'null'
  }
  const str = typeof value === 'bigint' ? value.toString() : JSON.stringify(value)
  // Remove quotes for cleaner display
  const cleanStr = str.replace(/^"(.*)"$/, '$1')

  // Trim to context around match
  const trimmedStr = regex && trim > 0 ? trimToContext(cleanStr, regex, trim) : cleanStr

  // Highlight matches if regex provided
  const highlighted = regex ? highlightMatches(trimmedStr, regex, invert) : trimmedStr

  // Escape pipe characters
  return highlighted.replace(/\|/g, '\\|')
}

/**
 * Render matches as a markdown table
 * @param {string} filePath
 * @param {Array<{rowOffset: number, row: Record<string, any>, regex: RegExp}>} matches
 * @param {boolean} invert - If true, don't highlight (inverted matches)
 * @param {number} trim - Maximum length of text (0 = no trim)
 */
export function renderMarkdownTable(filePath, matches, invert, trim) {
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
    const cells = columns.map(col => escapeMarkdownCell(row[col], regex, invert, trim))
    console.log(`| ${rowOffset} | ${cells.join(' | ')} |`)
  }
}

/**
 * Highlight matches in an object's values recursively
 * @param {any} obj
 * @param {RegExp} regex
 * @param {boolean} invert
 * @param {number} trim - Maximum length of text (0 = no trim)
 * @returns {any}
 */
function highlightObject(obj, regex, invert, trim) {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    const trimmedStr = regex && trim > 0 ? trimToContext(obj, regex, trim) : obj
    return highlightMatches(trimmedStr, regex, invert)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => highlightObject(item, regex, invert, trim))
  }

  if (typeof obj === 'object') {
    /** @type {Record<string, any>} */
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = highlightObject(value, regex, invert, trim)
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
 * @param {number} options.trim - Maximum length of text (0 = no trim)
 */
export function formatJsonlOutput({ filename, rowOffset, row, regex, invert, trim }) {
  const highlightedRow = regex && !invert ? highlightObject(row, regex, invert, trim) : row
  const output = {
    filename,
    rowOffset,
    value: highlightedRow,
  }
  console.log(JSON.stringify(toJson(output)))
}
