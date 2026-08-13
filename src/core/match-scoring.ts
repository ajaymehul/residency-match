/**
 * Enhanced "Match Chance" scoring algorithm using scraped data.
 *
 * 5 signals, each 0–100, with user-adjustable weights:
 * 1. Score Fit (25%): Does applicant's score fall within the US IMG invited range?
 * 2. IMG Interview Rate (25%): What % of US IMG applicants get interviews?
 * 3. Selectivity (20%): How favorable is the applicant/invited ratio for US IMGs?
 * 4. IMG Representation (15%): What % of current residents are US IMGs?
 * 5. Tech Hub Proximity (15%): Distance to nearest tech hub.
 */

import type { TechHub, Coordinates } from './types';
import { nearestTechHub } from './scoring';
import type { ScrapedProgram, EnrichedProgram } from './scraped-data-loader';

export interface MatchWeights {
  scoreFit: number;
  imgInterviewRate: number;
  selectivity: number;
  imgRepresentation: number;
  techHubProximity: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  scoreFit: 25,
  imgInterviewRate: 25,
  selectivity: 20,
  imgRepresentation: 15,
  techHubProximity: 15,
};

export interface MatchSignals {
  scoreFit: number | null;          // 0-100
  imgInterviewRate: number | null;  // 0-100
  selectivity: number | null;       // 0-100
  imgRepresentation: number | null; // 0-100
  techHubProximity: number | null;  // 0-100
}

export interface MatchResult {
  matchScore: number | null;  // 0-100 composite
  signals: MatchSignals;
  nearestHub: { name: string; distanceMiles: number } | null;
  // Useful extras for display
  usImgScoreMedian: number | null;
  usImgScoreRange: { p10: number; p25: number; median: number; p75: number; p90: number } | null;
  allScoreRange: { p10: number; p25: number; median: number; p75: number; p90: number } | null;
  usImgInterviewRatePct: number | null;
  usImgApplicantCount: number | null;
  usImgResidentPct: number | null;
  totalApplicants: number | null;
}

/**
 * Extract the US IMG specific boxplot data from step2_ck_scores.
 */
function getUsImgBoxplot(scores?: ScrapedProgram['step2_ck_scores']): { p10: number; p25: number; median: number; p75: number; p90: number } | null {
  if (!scores) return null;
  const entry = scores.find(s => s.parameters.applicant === 'US IMG Applicants Invited');
  if (!entry || !entry.series || !('median' in entry.series)) return null;
  const { lower, q1, median, q3, upper } = entry.series as { lower: number | null; q1: number | null; median: number | null; q3: number | null; upper: number | null };
  if (median == null || lower == null || upper == null || q1 == null || q3 == null) return null;
  return { p10: lower, p25: q1, median, p75: q3, p90: upper };
}

/**
 * Extract the All Applicants boxplot data.
 */
function getAllBoxplot(scores?: ScrapedProgram['step2_ck_scores']): { p10: number; p25: number; median: number; p75: number; p90: number } | null {
  if (!scores) return null;
  const entry = scores.find(s => s.parameters.applicant === 'All Applicants Invited');
  if (!entry || !entry.series || !('median' in entry.series)) return null;
  const { lower, q1, median, q3, upper } = entry.series as { lower: number | null; q1: number | null; median: number | null; q3: number | null; upper: number | null };
  if (median == null || lower == null || upper == null || q1 == null || q3 == null) return null;
  return { p10: lower, p25: q1, median, p75: q3, p90: upper };
}

/**
 * Signal 1: Score Fit (0-100)
 * How well the applicant's Step 2 score fits within the program's US IMG invited range.
 *
 * - At or above median → 100
 * - Between p10 and median → linear 50-100
 * - Below p10 → decreases sharply (0 at 30 points below p10)
 *
 * Falls back to All Applicants range if US IMG specific data unavailable.
 */
function computeScoreFit(applicantScore: number, scraped: ScrapedProgram): number | null {
  // Try US IMG specific first, then fall back to All
  const boxplot = getUsImgBoxplot(scraped.step2_ck_scores) || getAllBoxplot(scraped.step2_ck_scores);
  if (!boxplot) return null;

  const { p10, median } = boxplot;

  if (applicantScore >= median) {
    // At or above median: 100 (strong fit)
    return 100;
  }

  if (applicantScore >= p10) {
    // Between p10 and median: linear interpolation 50 → 100
    const range = median - p10;
    if (range === 0) return 100;
    return 50 + ((applicantScore - p10) / range) * 50;
  }

  // Below p10: steep falloff, 0 at 30 points below p10
  const gap = p10 - applicantScore;
  return Math.max(0, 50 * (1 - gap / 30));
}

/**
 * Signal 2: IMG Interview Rate (0-100)
 * Direct percentage of US IMG applicants that get interviews.
 * Already on a 0-100 scale from the scraped data.
 */
function computeImgInterviewRate(scraped: ScrapedProgram): number | null {
  const rate = scraped.interview_rates_by_type?.series?.['US IMG'];
  if (rate == null) return null;
  return Math.min(100, Math.max(0, rate)); // clamp
}

/**
 * Signal 3: Selectivity (0-100)
 * Measures how "winnable" the program is for US IMGs.
 * 
 * Formula: ratio of US IMG interview rate to overall competitiveness.
 * Higher US IMG rate + fewer total applicants per spot = better.
 * 
 * We use: (US IMG interview rate) × (spots / applicants × 10) capped at 100
 * This rewards programs with high IMG rates AND lower competition.
 */
function computeSelectivity(scraped: ScrapedProgram): number | null {
  const imgRate = scraped.interview_rates_by_type?.series?.['US IMG'];
  if (imgRate == null) return null;

  // Factor in competition: positions / applicants ratio
  const applicants = scraped.application_trends_2026?.eras_applicants;
  const positions = scraped.match_outcomes_2026?.categorical_offered;

  if (applicants && positions && applicants > 0) {
    // Acceptance density: how many positions per 100 applicants
    const acceptanceDensity = (positions / applicants) * 100;
    // Combine: IMG rate weighted by how many spots there are relative to applicants
    // Scale so that a program with 10% acceptance density and 30% IMG rate scores well
    const raw = imgRate * (1 + acceptanceDensity / 5);
    return Math.min(100, Math.max(0, raw));
  }

  // If we don't have applicant data, just use the raw IMG rate slightly discounted
  return Math.min(100, imgRate * 0.8);
}

/**
 * Signal 4: IMG Representation (0-100)
 * What percentage of current residents are US IMGs.
 * Programs that already have US IMGs are more likely to take more.
 * 
 * Direct from resident_student_type "US-IMG" percentage.
 * Scale: 0% → 0, 50%+ → 100 (very few programs have >50% US IMG)
 */
function computeImgRepresentation(scraped: ScrapedProgram): number | null {
  const pct = scraped.resident_student_type?.series?.['US-IMG'];
  if (pct == null) return null;
  // Scale: double it so 50% = 100. Most programs are 0-30%.
  return Math.min(100, pct * 2);
}

/**
 * Signal 5: Tech Hub Proximity (0-100)
 * Same as existing: linear decay to 0 at 150 miles.
 */
function computeTechHubProximity(coords: Coordinates | null, hubs: TechHub[]): { score: number | null; nearest: { name: string; distanceMiles: number } | null } {
  if (!coords || hubs.length === 0) return { score: null, nearest: null };
  
  const { hub, distance } = nearestTechHub(coords, hubs);
  const score = Math.max(0, 100 * (1 - distance / 150));
  return { score, nearest: { name: hub.name, distanceMiles: distance } };
}

/**
 * Compute the composite Match Chance Score for a program.
 */
export function computeMatchScore(
  program: EnrichedProgram,
  applicantScore: number,
  weights: MatchWeights,
  hubs: TechHub[],
): MatchResult {
  const scraped = program.scraped;
  
  const scoreFit = computeScoreFit(applicantScore, scraped);
  const imgInterviewRate = computeImgInterviewRate(scraped);
  const selectivity = computeSelectivity(scraped);
  const imgRepresentation = computeImgRepresentation(scraped);
  const { score: techHubProx, nearest } = computeTechHubProximity(program.coordinates, hubs);

  const signals: MatchSignals = {
    scoreFit,
    imgInterviewRate,
    selectivity,
    imgRepresentation,
    techHubProximity: techHubProx,
  };

  // Compute weighted composite (only over available signals)
  const signalEntries: { value: number; weight: number }[] = [];
  if (scoreFit !== null) signalEntries.push({ value: scoreFit, weight: weights.scoreFit });
  if (imgInterviewRate !== null) signalEntries.push({ value: imgInterviewRate, weight: weights.imgInterviewRate });
  if (selectivity !== null) signalEntries.push({ value: selectivity, weight: weights.selectivity });
  if (imgRepresentation !== null) signalEntries.push({ value: imgRepresentation, weight: weights.imgRepresentation });
  if (techHubProx !== null) signalEntries.push({ value: techHubProx, weight: weights.techHubProximity });

  let matchScore: number | null = null;
  if (signalEntries.length > 0) {
    const totalWeight = signalEntries.reduce((s, e) => s + e.weight, 0);
    if (totalWeight > 0) {
      matchScore = signalEntries.reduce((s, e) => s + e.value * (e.weight / totalWeight), 0);
    }
  }

  // Extract display data
  const usImgBoxplot = getUsImgBoxplot(scraped.step2_ck_scores);
  const allBoxplot = getAllBoxplot(scraped.step2_ck_scores);

  return {
    matchScore,
    signals,
    nearestHub: nearest,
    usImgScoreMedian: usImgBoxplot?.median ?? null,
    usImgScoreRange: usImgBoxplot,
    allScoreRange: allBoxplot,
    usImgInterviewRatePct: scraped.interview_rates_by_type?.series?.['US IMG'] ?? null,
    usImgApplicantCount: scraped.interview_rates_by_type?.parameters?.countUsimg ?? null,
    usImgResidentPct: scraped.resident_student_type?.series?.['US-IMG'] ?? null,
    totalApplicants: scraped.application_trends_2026?.eras_applicants ?? null,
  };
}
