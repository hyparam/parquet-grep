# parquet-grep

[![npm](https://img.shields.io/npm/v/parquet-grep)](https://www.npmjs.com/package/parquet-grep)
[![minzipped](https://img.shields.io/bundlephobia/minzip/parquet-grep)](https://www.npmjs.com/package/parquet-grep)
[![workflow status](https://github.com/hyparam/parquet-grep/actions/workflows/ci.yml/badge.svg)](https://github.com/hyparam/parquet-grep/actions)
[![mit license](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)

A CLI tool for searching text within Apache Parquet files. Works like `grep` but for Parquet files, with support for recursive directory search and multiple output formats.

Built on top of [hyparquet](https://github.com/hyparam/hyparquet) for high-performance Parquet parsing.

## Installation

```bash
npm install -g parquet-grep
```

Or use directly with npx:

```bash
npx parquet-grep "search term" file.parquet
```

## Usage

```bash
parquet-grep [options] <query> [parquet-file]
```

### Options

- `-i` - Force case-insensitive search (by default: case-insensitive if query is lowercase, case-sensitive if query contains uppercase)
- `-v` - Invert match (show non-matching rows)
- `-m <n>` / `--limit <n>` - Limit matches per file (default: 5, 0 = unlimited). Shows "..." when limit is exceeded
- `--table` - Output in markdown table format (default, grouped by file)
- `--jsonl` - Output as JSON lines (one match per line with filename, rowOffset, and value)

If no file is specified, recursively searches all `.parquet` files in the current directory, skipping `node_modules` and hidden directories.

### Examples

**Search a single file:**
```bash
parquet-grep "Holland" bunnies.parquet
```

**Search recursively in current directory:**
```bash
parquet-grep "search term"
```

**Case-insensitive search:**
```bash
parquet-grep -i "HOLLAND" bunnies.parquet
```

**JSONL output:**
```bash
parquet-grep --jsonl "Holland" bunnies.parquet
```

**Limit results:**
```bash
parquet-grep --limit 10 "search term" file.parquet  # Show at most 10 matches per file
parquet-grep --limit 0 "search term" file.parquet   # Unlimited matches
```
