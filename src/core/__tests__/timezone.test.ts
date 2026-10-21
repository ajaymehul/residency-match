import { describe, it, expect } from 'vitest';
import {
  defaultTimeZone,
  formatDateTimeInZone,
  formatTimeInZone,
  isValidTimeZone,
  localTimeZone,
  timeZoneForLocation,
  timeZoneOptions,
  tzAbbreviation,
  zonedWallTimeToUtc,
} from '../timezone';
import {
  compareByInterviewTime,
  deserializeInterviewData,
  formatInterviewWhen,
  interviewUtc,
  newInterviewRecord,
} from '../interview-store';

describe('zonedWallTimeToUtc', () => {
  it('converts Eastern daylight and standard time', () => {
    expect(zonedWallTimeToUtc('2026-10-15', '09:00', 'America/New_York')).toBe(Date.UTC(2026, 9, 15, 13, 0)); // EDT, UTC-4
    expect(zonedWallTimeToUtc('2027-01-15', '09:00', 'America/New_York')).toBe(Date.UTC(2027, 0, 15, 14, 0)); // EST, UTC-5
  });

  it('handles Arizona (no DST) and Pacific', () => {
    expect(zonedWallTimeToUtc('2026-07-01', '09:00', 'America/Phoenix')).toBe(Date.UTC(2026, 6, 1, 16, 0));
    expect(zonedWallTimeToUtc('2026-11-20', '08:30', 'America/Los_Angeles')).toBe(Date.UTC(2026, 10, 20, 16, 30));
  });

  it('handles the day after a DST change', () => {
    // US DST ends Nov 1 2026; Nov 2 is standard time.
    expect(zonedWallTimeToUtc('2026-11-02', '10:00', 'America/Chicago')).toBe(Date.UTC(2026, 10, 2, 16, 0));
  });

  it('rejects malformed input and invalid zones', () => {
    expect(zonedWallTimeToUtc('2026/10/15', '09:00', 'America/New_York')).toBeNull();
    expect(zonedWallTimeToUtc('2026-10-15', '9am', 'America/New_York')).toBeNull();
    expect(zonedWallTimeToUtc('2026-10-15', '09:00', 'Not/AZone')).toBeNull();
  });
});

describe('formatting always includes the zone abbreviation', () => {
  const nineEastern = Date.UTC(2026, 9, 15, 13, 0);

  it('formats the same instant in different zones', () => {
    expect(formatDateTimeInZone(nineEastern, 'America/New_York')).toBe('Thu, Oct 15, 9:00 AM EDT');
    expect(formatDateTimeInZone(nineEastern, 'America/Los_Angeles')).toBe('Thu, Oct 15, 6:00 AM PDT');
    expect(formatTimeInZone(nineEastern, 'America/Chicago')).toBe('8:00 AM CDT');
  });

  it('switches DST abbreviations by date', () => {
    expect(tzAbbreviation(Date.UTC(2027, 0, 15), 'America/New_York')).toBe('EST');
    expect(tzAbbreviation(Date.UTC(2026, 6, 15), 'America/New_York')).toBe('EDT');
  });
});

describe('default zone from program location', () => {
  it('uses the state, with city overrides for split states', () => {
    expect(timeZoneForLocation('Houston', 'TX')).toBe('America/Chicago');
    expect(timeZoneForLocation('El Paso', 'TX')).toBe('America/Denver');
    expect(timeZoneForLocation('Knoxville', 'TN')).toBe('America/New_York');
    expect(timeZoneForLocation('Tucson', 'AZ')).toBe('America/Phoenix');
    expect(timeZoneForLocation('Mayaguez', 'PR')).toBe('America/Puerto_Rico');
    expect(timeZoneForLocation('Anywhere', 'ZZ')).toBeNull();
  });

  it('falls back to a valid zone for unknown states', () => {
    expect(isValidTimeZone(defaultTimeZone('Anywhere', 'ZZ'))).toBe(true);
  });

  it('picker lists US zones with abbreviations and includes the current zone', () => {
    const opts = timeZoneOptions('Asia/Kolkata', Date.UTC(2026, 9, 15));
    expect(opts.find((o) => o.id === 'America/New_York')?.label).toContain('(EDT)');
    expect(opts.some((o) => o.id === 'Asia/Kolkata')).toBe(true);
  });
});

describe('interview records with time zones', () => {
  it('new records default to the program zone', () => {
    const rec = newInterviewRecord({ key: 'k', name: 'P', specialty: 'Family Medicine', city: 'Seattle', state: 'WA' });
    expect(rec.timeZone).toBe('America/Los_Angeles');
  });

  it('old saved records without a zone keep their original meaning: browser-local time', () => {
    const parsed = deserializeInterviewData({
      records: { k: { name: 'P', specialty: 'Internal Medicine', city: 'Bronx', state: 'NY', date: '2026-10-15', time: '09:00' } },
      matches: [],
    });
    expect(parsed.records.k.timeZone).toBe(localTimeZone());
  });

  it('formats in the viewer zone; date-only stays on its date', () => {
    const rec = { date: '2026-10-15', time: '09:00', timeZone: 'America/New_York' };
    expect(formatInterviewWhen(rec, 'America/Los_Angeles')).toBe('Thu, Oct 15, 6:00 AM PDT');
    expect(formatInterviewWhen({ ...rec, time: '' }, 'Asia/Tokyo')).toBe('Thu, Oct 15');
    expect(formatInterviewWhen({ date: '', time: '', timeZone: 'America/New_York' }, 'UTC')).toBe('—');
  });

  it('sorts by the real instant across zones, undated last', () => {
    const east10 = { name: 'East', date: '2026-10-15', time: '10:00', timeZone: 'America/New_York' }; // 14:00Z
    const west8 = { name: 'West', date: '2026-10-15', time: '08:00', timeZone: 'America/Los_Angeles' }; // 15:00Z
    const none = { name: 'None', date: '', time: '', timeZone: 'America/New_York' };
    const sorted = [none, west8, east10].sort(compareByInterviewTime).map((r) => r.name);
    expect(sorted).toEqual(['East', 'West', 'None']);
    expect(interviewUtc(none)).toBeNull();
  });
});
