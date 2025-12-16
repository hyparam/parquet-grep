import { asyncBufferFromFile, asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { isUrl } from './args.js'

/**
 * @typedef {object} SearchMatch
 * @property {number} rowOffset
 * @property {object} row
 * @property {RegExp} regex
 */

/**
 * Search a single parquet file (local or URL)
 * @param {string} filename
 * @param {RegExp} regex
 * @param {boolean} invert - If true, return non-matching rows
 * @yields {SearchMatch}
 */
export async function* searchFile(filename, regex, invert) {
  // Read the parquet file (local or URL)
  const file = isUrl(filename)
    ? await asyncBufferFromUrl({ url: filename })
    : await asyncBufferFromFile(filename)

  // Read metadata to get row group information
  const metadata = await parquetMetadataAsync(file)

  // Iterate through row groups one at a time to avoid loading entire file
  let rowOffset = 0
  for (const rowGroup of metadata.row_groups) {
    const numRows = Number(rowGroup.num_rows)
    const rowStart = rowOffset
    const rowEnd = rowOffset + numRows

    // Read just this row group
    const data = await parquetReadObjects({ file, compressors, rowStart, rowEnd })

    // Grep through the data, yielding matches as found
    for (let index = 0; index < data.length; index++) {
      const row = data[index]
      const isMatch = rowMatches(row, regex)
      if (invert ? !isMatch : isMatch) {
        yield { rowOffset: rowStart + index, row, regex }
      }
    }

    rowOffset = rowEnd
  }
}

/**
 * Check if a row matches the regex pattern
 * @param {Record<string, any>} row
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
