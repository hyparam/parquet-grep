import { describe, expect, it } from 'vitest'
import { parseArgs } from '../bin/args.js'

describe('parseArgs', () => {
  it('should parse query and file', () => {
    const result = parseArgs(['search-term', 'file.parquet'])
    expect(result.query).toBe('search-term')
    expect(result.file).toBe('file.parquet')
  })

  it('should parse query without file', () => {
    const result = parseArgs(['search-term'])
    expect(result.query).toBe('search-term')
    expect(result.file).toBeUndefined()
  })

  it('should handle -i flag with query and file', () => {
    const result = parseArgs(['-i', 'SEARCH', 'file.parquet'])
    expect(result.query).toBe('SEARCH')
    expect(result.file).toBe('file.parquet')
    expect(result.caseInsensitive).toBe(true)
  })

  it('should handle -i flag with query only', () => {
    const result = parseArgs(['-i', 'SEARCH'])
    expect(result.query).toBe('SEARCH')
    expect(result.file).toBeUndefined()
    expect(result.caseInsensitive).toBe(true)
  })

  describe('smart case', () => {
    it('should be case-insensitive for all lowercase query', () => {
      const result = parseArgs(['lowercase'])
      expect(result.caseInsensitive).toBe(true)
    })

    it('should be case-sensitive for query with uppercase', () => {
      const result = parseArgs(['UpperCase'])
      expect(result.caseInsensitive).toBe(false)
    })

    it('should be case-sensitive for all uppercase query', () => {
      const result = parseArgs(['UPPERCASE'])
      expect(result.caseInsensitive).toBe(false)
    })

    it('should force case-insensitive with -i flag even for uppercase', () => {
      const result = parseArgs(['-i', 'UPPERCASE'])
      expect(result.caseInsensitive).toBe(true)
    })
  })

  describe('-v flag (invert match)', () => {
    it('should parse -v flag', () => {
      const result = parseArgs(['-v', 'search-term'])
      expect(result.invert).toBe(true)
      expect(result.query).toBe('search-term')
    })

    it('should parse -v flag with file', () => {
      const result = parseArgs(['-v', 'search-term', 'file.parquet'])
      expect(result.invert).toBe(true)
      expect(result.query).toBe('search-term')
      expect(result.file).toBe('file.parquet')
    })

    it('should combine -v and -i flags', () => {
      const result = parseArgs(['-v', '-i', 'SEARCH'])
      expect(result.invert).toBe(true)
      expect(result.caseInsensitive).toBe(true)
      expect(result.query).toBe('SEARCH')
    })

    it('should combine -i and -v flags (order reversed)', () => {
      const result = parseArgs(['-i', '-v', 'SEARCH'])
      expect(result.invert).toBe(true)
      expect(result.caseInsensitive).toBe(true)
      expect(result.query).toBe('SEARCH')
    })

    it('should default invert to false when not specified', () => {
      const result = parseArgs(['search-term'])
      expect(result.invert).toBe(false)
    })
  })

  describe('limit flag (-m / --limit)', () => {
    it('should default limit to 5', () => {
      const result = parseArgs(['search-term'])
      expect(result.limit).toBe(5)
    })

    it('should parse -m flag with value', () => {
      const result = parseArgs(['-m', '10', 'search-term'])
      expect(result.limit).toBe(10)
      expect(result.query).toBe('search-term')
    })

    it('should parse --limit flag with value', () => {
      const result = parseArgs(['--limit', '20', 'search-term'])
      expect(result.limit).toBe(20)
      expect(result.query).toBe('search-term')
    })

    it('should handle limit of 0 (unlimited)', () => {
      const result = parseArgs(['-m', '0', 'search-term'])
      expect(result.limit).toBe(0)
    })

    it('should combine limit with other flags', () => {
      const result = parseArgs(['-i', '-m', '10', 'search-term'])
      expect(result.limit).toBe(10)
      expect(result.caseInsensitive).toBe(true)
      expect(result.query).toBe('search-term')
    })
  })
})
