/**
 * Interview rating criteria, taken from Program_Rankings.md.
 *
 * Each criterion is scored 1 (poor) – 5 (excellent). There are deliberately
 * no weights: how much each criterion matters is subjective, so ranking comes
 * from head-to-head Elo comparisons, not from a formula. The total (out of 75)
 * is shown only as a reference.
 */

export interface Criterion {
  id: CriterionId;
  label: string;
  description: string;
}

export type CriterionId =
  | 'location'
  | 'workLife'
  | 'nightDuty'
  | 'costOfLiving'
  | 'salary'
  | 'reputation'
  | 'didactics'
  | 'fellowship'
  | 'patientPopulation'
  | 'facultySupport'
  | 'research'
  | 'cultureFit'
  | 'moonlighting'
  | 'facilities'
  | 'vacation';

export const CRITERIA: readonly Criterion[] = [
  { id: 'location', label: 'Location', description: 'Proximity to family/support, city vs rural, climate, safety' },
  { id: 'workLife', label: 'Work-life balance', description: 'Hours, culture, protected time, burnout vibe' },
  { id: 'nightDuty', label: 'Night duty / call schedule', description: 'Night float vs call, frequency, how brutal it looks' },
  { id: 'costOfLiving', label: 'Cost of living', description: 'Housing, groceries, overall affordability in the area' },
  { id: 'salary', label: 'Salary & benefits', description: 'Stipend, health insurance, retirement, allowances' },
  { id: 'reputation', label: 'Program reputation / accreditation', description: 'ACGME status, track record, stability' },
  { id: 'didactics', label: 'Didactics & education quality', description: 'Teaching, board prep, curriculum structure' },
  { id: 'fellowship', label: 'Fellowship / career placement', description: 'Match rates, where grads end up' },
  { id: 'patientPopulation', label: 'Patient population & case mix', description: 'Diversity, volume, clinical autonomy' },
  { id: 'facultySupport', label: 'Faculty & resident support', description: 'Mentorship, approachability, wellness resources' },
  { id: 'research', label: 'Research opportunities', description: 'Access to projects, protected research time' },
  { id: 'cultureFit', label: 'Culture & fit', description: 'Gut feel from interview day, do I click with people' },
  { id: 'moonlighting', label: 'Moonlighting opportunities', description: 'Extra income potential' },
  { id: 'facilities', label: 'Facilities & resources', description: 'Hospital quality, EMR, sim, library' },
  { id: 'vacation', label: 'Vacation / leave policy', description: 'PTO, parental leave, sick time' },
];

export const CRITERION_IDS: ReadonlySet<string> = new Set(CRITERIA.map((c) => c.id));

/** Highest possible total: every criterion scored 5. */
export const MAX_SCORE_TOTAL = CRITERIA.length * 5;

export type Ratings = Partial<Record<CriterionId, number>>;

/** True for an integer 1–5. */
export function isValidScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

/** Number of criteria with a valid score. */
export function ratedCount(ratings: Ratings): number {
  return CRITERIA.reduce((n, c) => n + (isValidScore(ratings[c.id]) ? 1 : 0), 0);
}

/** True when every criterion has a score. */
export function isRatingComplete(ratings: Ratings): boolean {
  return ratedCount(ratings) === CRITERIA.length;
}

/** Plain sum of the 1–5 scores (unrated criteria contribute 0). Reference only. */
export function scoreTotal(ratings: Ratings): number {
  return CRITERIA.reduce((s, c) => {
    const v = ratings[c.id];
    return s + (isValidScore(v) ? v : 0);
  }, 0);
}
