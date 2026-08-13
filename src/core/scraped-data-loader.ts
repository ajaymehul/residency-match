/**
 * Data loader for scraped_programs.json
 * 
 * Loads the enriched program data scraped from Residency Explorer,
 * transforms it into the app's GeocodedProgram format, and computes
 * a LoadSummary.
 */

import type { GeocodedProgram, LoadSummary, FieldValue, ScoreRange, Specialty } from './types';
import type { CityDataset } from './geocoder';
import { geocode } from './geocoder';

/** Raw shape of a program from scraped_programs.json */
export interface ScrapedProgram {
  guid: string;
  url: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
  region?: string;
  email?: string;
  phone?: string;
  website?: string;
  program_director?: string;
  acgme_code?: string;
  visa_sponsorship?: { j1?: boolean; h1b?: boolean; f1?: boolean };
  training?: { length_years?: number; setting?: string; total_residents?: number };
  prior_gme_required?: boolean;
  
  // Application data
  application_trends_2026?: {
    eras_applicants?: number;
    invited_to_interview?: number;
    interview_rate_pct?: number;
  };
  selectivity_2026?: {
    program_applicants?: number;
    avg_specialty_applicants?: number;
    program_interview_pct?: number;
    avg_specialty_interview_pct?: number;
  };
  match_outcomes_2026?: {
    categorical_offered?: number;
    categorical_filled?: number;
    preliminary_offered?: number;
    preliminary_filled?: number;
    positions_offered?: number | string;
    positions_filled?: number | string;
  };

  // Chart data (from const locals JavaScript)
  step2_ck_scores?: Array<{
    series: { lower?: number | null; q1?: number | null; median?: number | null; q3?: number | null; upper?: number | null } | Record<string, never>;
    parameters: { applicant: string; status: number | null };
  }>;
  comlex_level2_scores?: Array<{
    series: { lower?: number | null; q1?: number | null; median?: number | null; q3?: number | null; upper?: number | null } | Record<string, never>;
    parameters: { applicant: string; status: number | null };
  }>;
  interview_rates_by_type?: {
    series: Record<string, number>;
    parameters: { countUsmd?: number; countUsdo?: number; countUsimg?: number; countFmg?: number };
  };
  applicant_composition?: {
    series: Record<string, number>;
    parameters: null;
  };
  invited_composition_by_type?: {
    series: Record<string, number>;
    parameters: null;
  };
  signal_rates?: {
    series: Record<string, number>;
    parameters: { countSent?: number; countDidNotSend?: number };
  };
  signal_composition_applicants?: { series: Record<string, number>; parameters: null };
  signal_composition_invited?: { series: Record<string, number>; parameters: null };
  interview_rates_geographic_preference?: {
    series: Record<string, number>;
    parameters: Record<string, number>;
  };
  interview_rates_home_state?: {
    series: Record<string, number>;
    parameters: Record<string, number>;
  };
  interview_rates_med_school_state?: {
    series: Record<string, number>;
    parameters: Record<string, number>;
  };
  interview_rates_step1?: {
    series: Record<string, number>;
    parameters: Record<string, number>;
  };
  interview_rates_step2_passfail?: {
    series: Record<string, number>;
    parameters: Record<string, number>;
  };
  resident_student_type?: {
    series: Record<string, number>;
    parameters: null;
  };
  specialty_avg_student_type?: {
    series: Record<string, number>;
    parameters: null;
  };
  resident_race?: { series: Record<string, number>; parameters: null };
  resident_gender?: { series: Record<string, number>; parameters: null };
  career_plans_chart?: { series: Record<string, number>; parameters: null };
  top_medical_schools?: { series: Record<string, number>; parameters: null };
  salary_table?: Array<{ year: number; salary: number; sickDays: number; vacationDays: number }>;
  salary?: Array<{ year: number; salary: number; sick_days: number; vacation_days: number }>;
  applicants_data?: unknown;
  program_strengths?: string;
  highlights?: string;
  career_plans?: Record<string, number>;
  benefits?: Record<string, boolean | number>;
  interview_requirements?: Record<string, string>;
}

/** Enriched program with all scraped data attached */
export interface EnrichedProgram extends GeocodedProgram {
  scraped: ScrapedProgram;
}

/**
 * Extract a Step 2 CK score range from the scraped boxplot data.
 * Uses the "US IMG Applicants Invited" series if available, falling back to "All Applicants Invited".
 */
function extractStep2Range(scores?: ScrapedProgram['step2_ck_scores']): FieldValue<ScoreRange> {
  if (!scores || scores.length === 0) return { kind: 'missing' };

  // Try US IMG first
  const usImg = scores.find(s => s.parameters.applicant === 'US IMG Applicants Invited');
  if (usImg && usImg.series && 'lower' in usImg.series && usImg.series.lower != null && usImg.series.upper != null) {
    return { kind: 'present', value: { low: usImg.series.lower, high: usImg.series.upper } };
  }

  // Fall back to All Applicants
  const all = scores.find(s => s.parameters.applicant === 'All Applicants Invited');
  if (all && all.series && 'lower' in all.series && all.series.lower != null && all.series.upper != null) {
    return { kind: 'present', value: { low: all.series.lower, high: all.series.upper } };
  }

  return { kind: 'missing' };
}

/**
 * Extract the US IMG interview rate from scraped data.
 * Returns as a fraction (0-1) to match the existing scoring system.
 */
function extractUsImgRate(program: ScrapedProgram): FieldValue<number> {
  const rate = program.interview_rates_by_type?.series?.['US IMG'];
  if (rate != null) {
    return { kind: 'present', value: rate / 100 }; // Convert from percentage to fraction
  }
  return { kind: 'missing' };
}

/**
 * Load scraped programs JSON and transform into GeocodedProgram[] for the app.
 */
export function loadScrapedPrograms(
  rawPrograms: ScrapedProgram[],
  cityDataset: CityDataset,
): { programs: EnrichedProgram[]; summary: LoadSummary } {
  const programs: EnrichedProgram[] = [];
  let geocodedCount = 0;
  let unmappedCount = 0;

  for (let i = 0; i < rawPrograms.length; i++) {
    const raw = rawPrograms[i];

    const name = raw.name || `Program ${raw.guid.slice(0, 8)}`;
    const city = raw.city || '';
    const state = raw.state || '';
    const region = raw.region || '';

    // Geocode
    const coords = city && state ? geocode(city, state, cityDataset) : null;
    if (coords) {
      geocodedCount++;
    } else {
      unmappedCount++;
    }

    // Build signal rates (using scraped signal data)
    const signalRates: Record<string, FieldValue<number>> = {};
    if (raw.signal_rates?.series) {
      const sent = raw.signal_rates.series['Sent'];
      const notSent = raw.signal_rates.series['Did Not Send'];
      if (sent != null) signalRates['signal'] = { kind: 'present', value: sent / 100 };
      if (notSent != null) signalRates['noSignal'] = { kind: 'present', value: notSent / 100 };
    }

    // Build the program
    const program: EnrichedProgram = {
      id: `Family Medicine:${i + 1}`,
      specialty: 'Family Medicine' as Specialty,
      name,
      step2Range: extractStep2Range(raw.step2_ck_scores),
      comlexRange: { kind: 'missing' },
      signalRates,
      inStateRate: raw.interview_rates_home_state?.series?.['In-State'] != null
        ? { kind: 'present', value: raw.interview_rates_home_state.series['In-State'] / 100 }
        : { kind: 'missing' },
      outOfStateRate: raw.interview_rates_home_state?.series?.['Out-of-State'] != null
        ? { kind: 'present', value: raw.interview_rates_home_state.series['Out-of-State'] / 100 }
        : { kind: 'missing' },
      usImgRate: extractUsImgRate(raw),
      city,
      state,
      region,
      sourceRow: i + 1,
      url: raw.url,
      coordinates: coords,
      unmapped: coords === null,
      scraped: raw,
    };

    programs.push(program);
  }

  const summary: LoadSummary = {
    loadedBySpecialty: { 'Family Medicine': programs.length, 'Internal Medicine': 0 },
    excludedRows: [],
    geocodedCount,
    unmappedCount,
  };

  return { programs, summary };
}
