import { toJson } from 'hyparquet'

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

export { renderMarkdownTable, formatJsonlOutput }
