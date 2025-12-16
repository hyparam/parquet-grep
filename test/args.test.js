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

  describe('offset flag (--offset)', () => {
    it('should default offset to 0', () => {
      const result = parseArgs(['search-term'])
      expect(result.offset).toBe(0)
    })

    it('should parse --offset flag with value', () => {
      const result = parseArgs(['--offset', '5', 'search-term'])
      expect(result.offset).toBe(5)
      expect(result.query).toBe('search-term')
    })

    it('should parse --offset flag with file', () => {
      const result = parseArgs(['--offset', '10', 'search-term', 'file.parquet'])
      expect(result.offset).toBe(10)
      expect(result.query).toBe('search-term')
      expect(result.file).toBe('file.parquet')
    })

    it('should handle offset of 0 explicitly', () => {
      const result = parseArgs(['--offset', '0', 'search-term'])
      expect(result.offset).toBe(0)
    })

    it('should combine offset with -i flag', () => {
      const result = parseArgs(['-i', '--offset', '3', 'search-term'])
      expect(result.offset).toBe(3)
      expect(result.caseInsensitive).toBe(true)
      expect(result.query).toBe('search-term')
    })

    it('should combine offset with -v flag', () => {
      const result = parseArgs(['--offset', '2', '-v', 'search-term'])
      expect(result.offset).toBe(2)
      expect(result.invert).toBe(true)
      expect(result.query).toBe('search-term')
    })

    it('should combine offset with limit', () => {
      const result = parseArgs(['--offset', '5', '--limit', '10', 'search-term'])
      expect(result.offset).toBe(5)
      expect(result.limit).toBe(10)
      expect(result.query).toBe('search-term')
    })

    it('should combine offset with multiple flags', () => {
      const result = parseArgs(['-i', '--offset', '2', '-v', '--limit', '3', 'search-term'])
      expect(result.offset).toBe(2)
      expect(result.limit).toBe(3)
      expect(result.caseInsensitive).toBe(true)
      expect(result.invert).toBe(true)
      expect(result.query).toBe('search-term')
    })
  })

  describe('trim flag (--trim)', () => {
    it('should default trim to 60', () => {
      const result = parseArgs(['search-term'])
      expect(result.trim).toBe(60)
    })

    it('should parse --trim flag with value', () => {
      const result = parseArgs(['--trim', '40', 'search-term'])
      expect(result.trim).toBe(40)
      expect(result.query).toBe('search-term')
    })

    it('should handle trim of 0 (no trim)', () => {
      const result = parseArgs(['--trim', '0', 'search-term'])
      expect(result.trim).toBe(0)
    })

    it('should combine trim with other flags', () => {
      const result = parseArgs(['-i', '--trim', '80', '--limit', '10', 'search-term'])
      expect(result.trim).toBe(80)
      expect(result.limit).toBe(10)
      expect(result.caseInsensitive).toBe(true)
      expect(result.query).toBe('search-term')
    })
  })
})
