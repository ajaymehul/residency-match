/**
 * Data loader for Programs.xlsx.
 *
 * Parses both specialty sheets into Program records and produces a
 * LoadSummary with per-specialty counts and excluded row details.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import * as XLSX from 'xlsx';
import type { FieldValue, ScoreRange, Program, ExcludedRow, LoadSummary, Specialty } from './types';
import type { SheetConfig } from './sheet-config';

/** Missing-value markers used in the source data. */
const MISSING_MARKERS = new Set(['--', '!']);

/**
 * Parse a raw cell string into a FieldValue<number>.
 *
 * - `--` and `!` → missing
 * - Numeric strings (e.g. "0.79", "214") → present with the parsed number
 * - Anything else → invalid with the raw string retained
 *
 * All source cells are strings, so numbers are parsed from strings.
 *
 * Requirements: 1.4
 */
export function parseCell(raw: string): FieldValue<number> {
  const trimmed = raw.trim();

  if (MISSING_MARKERS.has(trimmed)) {
    return { kind: 'missing' };
  }

  if (trimmed === '') {
    return { kind: 'missing' };
  }

  const num = Number(trimmed);
  if (!isNaN(num) && isFinite(num)) {
    return { kind: 'present', value: num };
  }

  return { kind: 'invalid', raw };
}

/**
 * Parse a raw score range string into a FieldValue<ScoreRange>.
 *
 * - Missing markers (`--`, `!`) → missing
 * - `"low-high"` where both bounds are integers and low <= high → present
 * - Malformed content (non-integer bounds, low > high, wrong format) → invalid
 *
 * Requirements: 1.5
 */
export function parseScoreRange(raw: string): FieldValue<ScoreRange> {
  const trimmed = raw.trim();

  if (MISSING_MARKERS.has(trimmed)) {
    return { kind: 'missing' };
  }

  if (trimmed === '') {
    return { kind: 'missing' };
  }

  // Split on '-' but handle potential negative numbers by finding the
  // separator dash. The format is "low-high" where both are non-negative
  // integers, so we look for a '-' that separates two parts.
  const dashIndex = trimmed.indexOf('-', trimmed.startsWith('-') ? 1 : 0);
  if (dashIndex === -1) {
    return { kind: 'invalid', raw };
  }

  const lowStr = trimmed.slice(0, dashIndex);
  const highStr = trimmed.slice(dashIndex + 1);

  // Both parts must be valid integers
  const low = Number(lowStr);
  const high = Number(highStr);

  if (
    !Number.isInteger(low) ||
    !Number.isInteger(high) ||
    lowStr.trim() === '' ||
    highStr.trim() === ''
  ) {
    return { kind: 'invalid', raw };
  }

  // low must be <= high
  if (low > high) {
    return { kind: 'invalid', raw };
  }

  return { kind: 'present', value: { low, high } };
}

/**
 * Get the raw string value of a cell, defaulting to empty string.
 * For numeric cells, use the raw value (v) to avoid formatted strings like "79%".
 * For string cells, use the formatted text (w) or raw value (v).
 */
function cellToString(cell: XLSX.CellObject | undefined): string {
  if (cell == null) return '';
  // For numeric cells, always use raw value to avoid formatted strings like "79%"
  if (cell.t === 'n' && cell.v != null) return String(cell.v);
  // For other cells, prefer formatted text, fall back to raw value
  if (cell.w != null) return String(cell.w);
  if (cell.v != null) return String(cell.v);
  return '';
}

/**
 * Parse a single data row into a Program record or an ExcludedRow.
 *
 * - Builds a Program tagged with the sheet's specialty.
 * - Individual fields degrade to `missing`/`invalid` (field-level degradation).
 * - Empty or missing program name → ExcludedRow with sheet name, row number, and reason.
 *
 * @param cells - Array of raw cell values (strings) for this row, 0-indexed by column.
 * @param config - The SheetConfig for the current sheet.
 * @param rowNumber - 1-based row number in the source sheet.
 *
 * Requirements: 1.1, 1.2, 1.4, 1.6
 */
export function parseRow(
  cells: string[],
  config: SheetConfig,
  rowNumber: number,
): Program | ExcludedRow {
  const { columns, specialty, sheetName } = config;

  // Extract program name
  const rawName = (cells[columns.programName] ?? '').trim();

  // Empty/missing program name → exclude the row
  if (rawName === '') {
    return {
      sheetName,
      rowNumber,
      reason: 'Empty or missing program name',
    } satisfies ExcludedRow;
  }

  // Parse signal rates
  const signalRates: Record<string, FieldValue<number>> = {};
  for (const [key, colIndex] of Object.entries(columns.signalRates)) {
    signalRates[key] = parseCell(cells[colIndex] ?? '');
  }

  // Build the Program record
  const program: Program = {
    id: `${specialty}:${rowNumber}`,
    specialty,
    name: rawName,
    step2Range: parseScoreRange(cells[columns.step2Range] ?? ''),
    comlexRange: parseScoreRange(cells[columns.comlexRange] ?? ''),
    signalRates,
    inStateRate: parseCell(cells[columns.inStateRate] ?? ''),
    outOfStateRate: parseCell(cells[columns.outOfStateRate] ?? ''),
    usImgRate: parseCell(cells[columns.usImgRate] ?? ''),
    city: (cells[columns.city] ?? '').trim(),
    state: (cells[columns.state] ?? '').trim(),
    region: (cells[columns.region] ?? '').trim(),
    sourceRow: rowNumber,
  };

  return program;
}

/**
 * Parse an entire workbook (both specialty sheets) into Program records
 * and a LoadSummary.
 *
 * - Skips the configured header rows per sheet.
 * - Parses all data rows, ignoring the `0/0` marker column (column 0).
 * - Accumulates LoadSummary with loaded counts per specialty and excluded rows.
 * - Treats a missing/unrecognized sheet as failed and continues with the other sheet.
 * - Extracts hyperlinks from program name cells (stored by SheetJS in cell.l.Target).
 *
 * @param workbook - A SheetJS WorkBook object.
 * @param configs - Array of SheetConfig objects (one per specialty sheet).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
 */
export function parseWorkbook(
  workbook: XLSX.WorkBook,
  configs: SheetConfig[],
): { programs: Program[]; summary: LoadSummary } {
  const programs: Program[] = [];
  const excludedRows: ExcludedRow[] = [];
  const loadedBySpecialty: Record<Specialty, number> = {
    'Family Medicine': 0,
    'Internal Medicine': 0,
  };

  for (const config of configs) {
    const worksheet = workbook.Sheets[config.sheetName];

    // Missing/unrecognized sheet: report failure and continue
    if (!worksheet) {
      excludedRows.push({
        sheetName: config.sheetName,
        rowNumber: 0,
        reason: `Sheet "${config.sheetName}" not found in workbook`,
      });
      continue;
    }

    // Determine the range of the sheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');

    // Data rows start after the header rows (0-indexed internally, 1-indexed for user)
    const dataStartRow = range.s.r + config.headerRowCount;

    for (let r = dataStartRow; r <= range.e.r; r++) {
      // Read all cells in this row as strings
      const cells: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddr] as XLSX.CellObject | undefined;
        cells[c] = cellToString(cell);
      }

      // The 1-based row number as seen in the spreadsheet (Excel uses 1-based)
      const rowNumber = r + 1;

      const result = parseRow(cells, config, rowNumber);

      if ('reason' in result) {
        // ExcludedRow
        excludedRows.push(result);
      } else {
        // Extract hyperlink from program name cell if present
        const nameColIndex = config.columns.programName;
        const nameCellAddr = XLSX.utils.encode_cell({ r, c: nameColIndex });
        const nameCell = worksheet[nameCellAddr] as (XLSX.CellObject & { l?: { Target?: string } }) | undefined;
        if (nameCell?.l?.Target) {
          result.url = nameCell.l.Target;
        }

        // Program
        programs.push(result);
        loadedBySpecialty[config.specialty] =
          (loadedBySpecialty[config.specialty] ?? 0) + 1;
      }
    }
  }

  const summary: LoadSummary = {
    loadedBySpecialty,
    excludedRows,
    geocodedCount: 0,
    unmappedCount: 0,
  };

  return { programs, summary };
}
