/**
 * Unit tests for parseRow and parseWorkbook.
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRow, parseWorkbook } from '../data-loader';
import { familyMedicineConfig, internalMedicineConfig, SHEET_CONFIGS } from '../sheet-config';
import type { Program, ExcludedRow } from '../types';

describe('parseRow', () => {
  const config = familyMedicineConfig;

  function buildCells(overrides: Record<number, string> = {}): string[] {
    // Default valid FM row: marker(0), name(1), step2(2), comlex(3),
    // signal(4), noSignal(5), inState(6), outState(7), usImg(8),
    // city(9), state(10), region(11)
    const defaults: Record<number, string> = {
      0: '0/0',
      1: 'Test Program',
      2: '214-247',
      3: '402-493',
      4: '0.21',
      5: '0.29',
      6: '0.79',
      7: '0.32',
      8: '0.44',
      9: 'Philadelphia',
      10: 'PA',
      11: 'Middle Atlantic',
    };
    const merged = { ...defaults, ...overrides };
    const cells: string[] = [];
    for (const [k, v] of Object.entries(merged)) {
      cells[Number(k)] = v;
    }
    return cells;
  }

  it('parses a valid row into a Program', () => {
    const cells = buildCells();
    const result = parseRow(cells, config, 4);

    expect('id' in result).toBe(true);
    const program = result as Program;
    expect(program.id).toBe('Family Medicine:4');
    expect(program.specialty).toBe('Family Medicine');
    expect(program.name).toBe('Test Program');
    expect(program.step2Range).toEqual({ kind: 'present', value: { low: 214, high: 247 } });
    expect(program.comlexRange).toEqual({ kind: 'present', value: { low: 402, high: 493 } });
    expect(program.signalRates['signal']).toEqual({ kind: 'present', value: 0.21 });
    expect(program.signalRates['noSignal']).toEqual({ kind: 'present', value: 0.29 });
    expect(program.inStateRate).toEqual({ kind: 'present', value: 0.79 });
    expect(program.outOfStateRate).toEqual({ kind: 'present', value: 0.32 });
    expect(program.usImgRate).toEqual({ kind: 'present', value: 0.44 });
    expect(program.city).toBe('Philadelphia');
    expect(program.state).toBe('PA');
    expect(program.region).toBe('Middle Atlantic');
    expect(program.sourceRow).toBe(4);
  });

  it('excludes a row with empty program name', () => {
    const cells = buildCells({ 1: '' });
    const result = parseRow(cells, config, 5);

    expect('reason' in result).toBe(true);
    const excluded = result as ExcludedRow;
    expect(excluded.sheetName).toBe('Family Medicine');
    expect(excluded.rowNumber).toBe(5);
    expect(excluded.reason).toContain('Empty');
  });

  it('excludes a row with whitespace-only program name', () => {
    const cells = buildCells({ 1: '   ' });
    const result = parseRow(cells, config, 6);

    expect('reason' in result).toBe(true);
  });

  it('degrades individual fields to missing when cells contain --', () => {
    const cells = buildCells({ 4: '--', 6: '!' });
    const result = parseRow(cells, config, 7) as Program;

    expect(result.signalRates['signal']).toEqual({ kind: 'missing' });
    expect(result.inStateRate).toEqual({ kind: 'missing' });
    // Name is still valid
    expect(result.name).toBe('Test Program');
  });

  it('degrades invalid score ranges to invalid', () => {
    const cells = buildCells({ 2: 'abc-def' });
    const result = parseRow(cells, config, 8) as Program;

    expect(result.step2Range).toEqual({ kind: 'invalid', raw: 'abc-def' });
  });

  it('handles Internal Medicine sheet config with extra signal columns', () => {
    const imConfig = internalMedicineConfig;
    const cells: string[] = [];
    cells[0] = '0/0';
    cells[1] = 'IM Program';
    cells[2] = '220-250';
    cells[3] = '410-500';
    cells[4] = '0.18'; // silverSignal
    cells[5] = '0.25'; // goldSignal
    cells[6] = '0.30'; // noSignal
    cells[7] = '0.75'; // inState
    cells[8] = '0.35'; // outState
    cells[9] = '0.40'; // usImg
    cells[10] = 'New York';
    cells[11] = 'NY';
    cells[12] = 'Middle Atlantic';

    const result = parseRow(cells, imConfig, 4) as Program;

    expect(result.specialty).toBe('Internal Medicine');
    expect(result.signalRates['silverSignal']).toEqual({ kind: 'present', value: 0.18 });
    expect(result.signalRates['goldSignal']).toEqual({ kind: 'present', value: 0.25 });
    expect(result.signalRates['noSignal']).toEqual({ kind: 'present', value: 0.30 });
  });
});

describe('parseWorkbook', () => {
  function makeWorkbook(
    sheets: Record<string, (string | undefined)[][]>,
  ): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    for (const [name, data] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    return wb;
  }

  it('parses a workbook with both sheets and produces correct summary', () => {
    // Create a workbook with 3 header rows + 2 data rows per sheet
    const fmData = [
      ['Title row'],
      ['Group headers'],
      ['0/0', 'Program', 'Step2', 'COMLEX', 'Signal', 'NoSignal', 'InState', 'OutState', 'USImg', 'City', 'State', 'Region'],
      ['0/0', 'FM Program 1', '214-247', '402-493', '0.21', '0.29', '0.79', '0.32', '0.44', 'Philadelphia', 'PA', 'Middle Atlantic'],
      ['0/0', 'FM Program 2', '200-230', '--', '0.15', '0.35', '--', '0.40', '0.50', 'Chicago', 'IL', 'East North Central'],
    ];

    const imData = [
      ['Title row'],
      ['Group headers'],
      ['0/0', 'Program', 'Step2', 'COMLEX', 'Silver', 'Gold', 'NoSignal', 'InState', 'OutState', 'USImg', 'City', 'State', 'Region'],
      ['0/0', 'IM Program 1', '220-250', '410-500', '0.18', '0.25', '0.30', '0.75', '0.35', '0.40', 'New York', 'NY', 'Middle Atlantic'],
      ['0/0', '', '220-250', '410-500', '0.18', '0.25', '0.30', '0.75', '0.35', '0.40', 'Boston', 'MA', 'New England'],
    ];

    const wb = makeWorkbook({
      'Family Medicine': fmData,
      'Internal Medicine': imData,
    });

    const { programs, summary } = parseWorkbook(wb, SHEET_CONFIGS);

    // 2 FM programs loaded, 1 IM loaded, 1 IM excluded (empty name)
    expect(programs).toHaveLength(3);
    expect(summary.loadedBySpecialty['Family Medicine']).toBe(2);
    expect(summary.loadedBySpecialty['Internal Medicine']).toBe(1);
    expect(summary.excludedRows).toHaveLength(1);
    expect(summary.excludedRows[0].sheetName).toBe('Internal Medicine');
    expect(summary.excludedRows[0].reason).toContain('Empty');
  });

  it('handles a missing sheet gracefully', () => {
    // Only Family Medicine sheet exists
    const fmData = [
      ['Title row'],
      ['Group headers'],
      ['Header cols'],
      ['0/0', 'FM Program', '214-247', '402-493', '0.21', '0.29', '0.79', '0.32', '0.44', 'Philadelphia', 'PA', 'Middle Atlantic'],
    ];

    const wb = makeWorkbook({ 'Family Medicine': fmData });

    const { programs, summary } = parseWorkbook(wb, SHEET_CONFIGS);

    // 1 FM program loaded, IM sheet missing → reported in excludedRows
    expect(programs).toHaveLength(1);
    expect(summary.loadedBySpecialty['Family Medicine']).toBe(1);
    expect(summary.loadedBySpecialty['Internal Medicine']).toBe(0);
    expect(summary.excludedRows.some(
      e => e.sheetName === 'Internal Medicine' && e.reason.includes('not found'),
    )).toBe(true);
  });

  it('skips exactly the configured number of header rows', () => {
    // 3 header rows + 1 data row
    const fmData = [
      ['Header 1'],
      ['Header 2'],
      ['Header 3'],
      ['0/0', 'Only Data Row', '200-230', '400-450', '0.10', '0.20', '0.60', '0.30', '0.35', 'Austin', 'TX', 'West South Central'],
    ];

    const wb = makeWorkbook({
      'Family Medicine': fmData,
      'Internal Medicine': [['H1'], ['H2'], ['H3']], // empty data
    });

    const { programs, summary } = parseWorkbook(wb, SHEET_CONFIGS);

    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe('Only Data Row');
    expect(summary.loadedBySpecialty['Family Medicine']).toBe(1);
  });

  it('reports geocodedCount and unmappedCount as 0 initially', () => {
    const fmData = [
      ['H1'], ['H2'], ['H3'],
      ['0/0', 'Prog', '200-230', '400-450', '0.10', '0.20', '0.60', '0.30', '0.35', 'City', 'ST', 'Region'],
    ];
    const wb = makeWorkbook({
      'Family Medicine': fmData,
      'Internal Medicine': [['H1'], ['H2'], ['H3']],
    });

    const { summary } = parseWorkbook(wb, SHEET_CONFIGS);

    expect(summary.geocodedCount).toBe(0);
    expect(summary.unmappedCount).toBe(0);
  });

  it('ignores the 0/0 marker column (column 0) and does not parse it as data', () => {
    const fmData = [
      ['H1'], ['H2'], ['H3'],
      ['0/0', 'Test Prog', '200-230', '400-450', '0.10', '0.20', '0.60', '0.30', '0.35', 'Austin', 'TX', 'West South Central'],
    ];
    const wb = makeWorkbook({
      'Family Medicine': fmData,
      'Internal Medicine': [['H1'], ['H2'], ['H3']],
    });

    const { programs } = parseWorkbook(wb, SHEET_CONFIGS);

    // The 0/0 marker column is at index 0; programName is at index 1
    // Verify that the marker column was not mistakenly parsed as any field
    expect(programs[0].name).toBe('Test Prog');
    expect(programs[0].id).toContain('Family Medicine');
  });
});
