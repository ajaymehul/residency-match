/**
 * Declarative column-index-to-field mappings for each specialty sheet
 * in Programs.xlsx. This is the single configuration location for column
 * layout (Requirement 1.8).
 *
 * Each SheetConfig describes one sheet: its name, specialty, header row
 * count, and the 0-based column indices for every parsed field.
 */

import type { Specialty } from './types';

/**
 * Configuration for a single sheet in the Programs.xlsx workbook.
 * The parser uses this to locate fields by column index.
 */
export interface SheetConfig {
  /** Exact sheet name as it appears in the workbook tab. */
  sheetName: string;
  /** Specialty tag applied to all programs from this sheet. */
  specialty: Specialty;
  /** Number of header rows to skip before data rows begin. */
  headerRowCount: number;
  /** 0-based column indices for each parsed field. */
  columns: {
    programName: number;
    step2Range: number;
    comlexRange: number;
    /** Per-specialty signal rate columns. FM: signal/noSignal; IM: silverSignal/goldSignal/noSignal. */
    signalRates: Record<string, number>;
    inStateRate: number;
    outOfStateRate: number;
    usImgRate: number;
    city: number;
    state: number;
    region: number;
  };
}

/**
 * Family Medicine sheet configuration.
 * 12 columns: marker(0), programName(1), step2Range(2), comlexRange(3),
 * signal(4), noSignal(5), inStateRate(6), outOfStateRate(7),
 * usImgRate(8), city(9), state(10), region(11).
 */
export const familyMedicineConfig: SheetConfig = {
  sheetName: 'Family Medicine',
  specialty: 'Family Medicine',
  headerRowCount: 3,
  columns: {
    programName: 1,
    step2Range: 2,
    comlexRange: 3,
    signalRates: {
      signal: 4,
      noSignal: 5,
    },
    inStateRate: 6,
    outOfStateRate: 7,
    usImgRate: 8,
    city: 9,
    state: 10,
    region: 11,
  },
};

/**
 * Internal Medicine sheet configuration.
 * 13 columns: marker(0), programName(1), step2Range(2), comlexRange(3),
 * silverSignal(4), goldSignal(5), noSignal(6), inStateRate(7),
 * outOfStateRate(8), usImgRate(9), city(10), state(11), region(12).
 */
export const internalMedicineConfig: SheetConfig = {
  sheetName: 'Internal Medicine',
  specialty: 'Internal Medicine',
  headerRowCount: 3,
  columns: {
    programName: 1,
    step2Range: 2,
    comlexRange: 3,
    signalRates: {
      silverSignal: 4,
      goldSignal: 5,
      noSignal: 6,
    },
    inStateRate: 7,
    outOfStateRate: 8,
    usImgRate: 9,
    city: 10,
    state: 11,
    region: 12,
  },
};

/** All sheet configurations, used by the workbook parser. */
export const SHEET_CONFIGS: SheetConfig[] = [
  familyMedicineConfig,
  internalMedicineConfig,
];
