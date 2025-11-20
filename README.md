# parquet-grep

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
