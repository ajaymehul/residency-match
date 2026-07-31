/**
 * FilterPanel component.
 *
 * Controls for all filters (specialty, state, region, min Fit_Score,
 * min IMG_Friendliness, max tech hub distance, Step 2 compatibility),
 * a clear-all action, applicant score input (default 223), and three
 * weight sliders with "reset to 40/40/20" and a minimum guard against
 * all-zero weights. Displayed weights renormalize to 100%.
 *
 * Requirements: 4.6, 7.3, 8.1, 8.2, 8.3
 */

import { useMemo, type ChangeEvent } from 'react';
import type { Specialty, Weights } from '../core/types';
import { useAppState } from './AppState';
import { ExportButton } from './ExportButton';

/** Minimum value a single weight slider can hold to prevent all-zero. */
const MIN_WEIGHT = 0.1;

/** Default weights matching the spec: 40/40/20. */
const DEFAULT_WEIGHTS: Weights = { step2: 0.4, img: 0.4, proximity: 0.2 };

/**
 * Renormalize raw weights so they sum to 100% for display purposes.
 * Returns percentages (0–100) for each weight.
 */
function renormalizeForDisplay(weights: Weights): { step2: number; img: number; proximity: number } {
  const total = weights.step2 + weights.img + weights.proximity;
  if (total === 0) {
    return { step2: 33, img: 33, proximity: 34 };
  }
  return {
    step2: Math.round((weights.step2 / total) * 100),
    img: Math.round((weights.img / total) * 100),
    proximity: Math.round((weights.proximity / total) * 100),
  };
}

export function FilterPanel() {
  const { applicantScore, weights, filters, derived, actions } = useAppState();

  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    for (const p of derived.scoredPrograms) {
      if (p.state) states.add(p.state);
    }
    return Array.from(states).sort();
  }, [derived.scoredPrograms]);

  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    for (const p of derived.scoredPrograms) {
      if (p.region) regions.add(p.region);
    }
    return Array.from(regions).sort();
  }, [derived.scoredPrograms]);

  const displayWeights = renormalizeForDisplay(weights);

  // --- Filter handlers ---

  const handleSpecialtyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      const { specialty: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, specialty: value as Specialty });
    }
  };

  const handleStateToggle = (state: string) => {
    const current = filters.states ?? [];
    const next = current.includes(state)
      ? current.filter((s) => s !== state)
      : [...current, state];
    if (next.length === 0) {
      const { states: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, states: next });
    }
  };

  const handleRegionToggle = (region: string) => {
    const current = filters.regions ?? [];
    const next = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    if (next.length === 0) {
      const { regions: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, regions: next });
    }
  };

  const handleMinFitScoreChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || Number(value) <= 0) {
      const { minFitScore: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, minFitScore: Number(value) });
    }
  };

  const handleMinImgFriendlinessChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || Number(value) <= 0) {
      const { minImgFriendliness: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, minImgFriendliness: Number(value) });
    }
  };

  const handleMaxTechHubDistanceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || Number(value) <= 0) {
      const { maxTechHubDistance: _, ...rest } = filters;
      actions.setFilters(rest);
    } else {
      actions.setFilters({ ...filters, maxTechHubDistance: Number(value) });
    }
  };

  const handleStep2CompatibleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      actions.setFilters({ ...filters, step2Compatible: true });
    } else {
      const { step2Compatible: _, ...rest } = filters;
      actions.setFilters(rest);
    }
  };

  const handleHideIncompleteDataChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      actions.setFilters({ ...filters, hideIncompleteData: true });
    } else {
      const { hideIncompleteData: _, ...rest } = filters;
      actions.setFilters(rest);
    }
  };

  const handleClearAll = () => {
    actions.setFilters({});
  };

  // --- Applicant score handler ---

  const handleApplicantScoreChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= 0) {
      actions.setApplicantScore(value);
    }
  };

  // --- Weight slider handlers ---

  const handleWeightChange = (key: keyof Weights, rawValue: number) => {
    const next = { ...weights, [key]: rawValue };
    if (next.step2 === 0 && next.img === 0 && next.proximity === 0) {
      next[key] = MIN_WEIGHT;
    }
    actions.setWeights(next);
  };

  const handleResetWeights = () => {
    actions.setWeights(DEFAULT_WEIGHTS);
  };

  return (
    <div className="space-y-4 text-sm" role="region" aria-label="Filters and Weights">
      {/* Applicant Score */}
      <fieldset className="border-none p-0 m-0">
        <legend className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-2">
          Applicant Score
        </legend>
        <label htmlFor="applicant-score" className="block text-xs text-gray-600 mb-1">
          Step 2 CK Score
        </label>
        <input
          id="applicant-score"
          type="number"
          min={0}
          max={300}
          value={applicantScore}
          onChange={handleApplicantScoreChange}
          className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple"
        />
      </fieldset>

      <div className="border-t border-brand-rose/30" />

      {/* Weight Sliders */}
      <fieldset className="border-none p-0 m-0">
        <legend className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-2">
          Weights
        </legend>
        <div className="space-y-3">
          <div>
            <label htmlFor="weight-step2" className="block text-xs text-gray-600 mb-0.5">
              Step2 Fit: {displayWeights.step2}%
            </label>
            <input
              id="weight-step2"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights.step2}
              onChange={(e) => handleWeightChange('step2', Number(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-img" className="block text-xs text-gray-600 mb-0.5">
              IMG Friendliness: {displayWeights.img}%
            </label>
            <input
              id="weight-img"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights.img}
              onChange={(e) => handleWeightChange('img', Number(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-proximity" className="block text-xs text-gray-600 mb-0.5">
              Tech Hub Proximity: {displayWeights.proximity}%
            </label>
            <input
              id="weight-proximity"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights.proximity}
              onChange={(e) => handleWeightChange('proximity', Number(e.target.value))}
              className="w-full accent-brand-purple"
            />
          </div>
          <button
            type="button"
            onClick={handleResetWeights}
            className="w-full px-3 py-1.5 text-xs border border-brand-purple text-brand-purple rounded-md hover:bg-brand-purple hover:text-white transition-colors"
          >
            Reset to 40/40/20
          </button>
        </div>
      </fieldset>

      <div className="border-t border-brand-rose/30" />

      {/* Filters */}
      <fieldset className="border-none p-0 m-0">
        <legend className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-2">
          Filters
        </legend>

        <div className="space-y-3">
          {/* Specialty */}
          <div>
            <label htmlFor="filter-specialty" className="block text-xs text-gray-600 mb-1">
              Specialty
            </label>
            <select
              id="filter-specialty"
              value={filters.specialty ?? ''}
              onChange={handleSpecialtyChange}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple"
            >
              <option value="">All</option>
              <option value="Family Medicine">Family Medicine</option>
              <option value="Internal Medicine">Internal Medicine</option>
            </select>
          </div>

          {/* States */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">States</label>
            <div
              className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 shadow-inner bg-gray-50/50 space-y-0.5"
              role="group"
              aria-label="State filters"
            >
              {uniqueStates.map((state) => (
                <label key={state} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-brand-purple">
                  <input
                    type="checkbox"
                    checked={(filters.states ?? []).includes(state)}
                    onChange={() => handleStateToggle(state)}
                    className="accent-brand-purple rounded"
                  />
                  {state}
                </label>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Regions</label>
            <div
              className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 shadow-inner bg-gray-50/50 space-y-0.5"
              role="group"
              aria-label="Region filters"
            >
              {uniqueRegions.map((region) => (
                <label key={region} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-brand-purple">
                  <input
                    type="checkbox"
                    checked={(filters.regions ?? []).includes(region)}
                    onChange={() => handleRegionToggle(region)}
                    className="accent-brand-purple rounded"
                  />
                  {region}
                </label>
              ))}
            </div>
          </div>

          {/* Min Fit Score */}
          <div>
            <label htmlFor="filter-min-fit-score" className="block text-xs text-gray-600 mb-1">
              Min Fit Score
            </label>
            <input
              id="filter-min-fit-score"
              type="number"
              min={0}
              max={100}
              step={1}
              value={filters.minFitScore ?? ''}
              onChange={handleMinFitScoreChange}
              placeholder="0"
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple"
            />
          </div>

          {/* Min IMG Friendliness */}
          <div>
            <label htmlFor="filter-min-img" className="block text-xs text-gray-600 mb-1">
              Min IMG Friendliness
            </label>
            <input
              id="filter-min-img"
              type="number"
              min={0}
              max={100}
              step={1}
              value={filters.minImgFriendliness ?? ''}
              onChange={handleMinImgFriendlinessChange}
              placeholder="0"
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple"
            />
          </div>

          {/* Max Tech Hub Distance */}
          <div>
            <label htmlFor="filter-max-distance" className="block text-xs text-gray-600 mb-1">
              Max Tech Hub Distance (miles)
            </label>
            <input
              id="filter-max-distance"
              type="number"
              min={0}
              max={500}
              step={5}
              value={filters.maxTechHubDistance ?? ''}
              onChange={handleMaxTechHubDistanceChange}
              placeholder="150"
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple"
            />
          </div>

          {/* Step 2 Compatible */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filters.step2Compatible ?? false}
              onChange={handleStep2CompatibleChange}
              className="accent-brand-purple rounded"
            />
            Step 2 Compatible Only
          </label>

          {/* Hide Incomplete Data */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hideIncompleteData ?? false}
              onChange={handleHideIncompleteDataChange}
              className="accent-brand-purple rounded"
            />
            Hide programs without Step 2 &amp; IMG data
          </label>

          {/* Clear All */}
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full px-3 py-1.5 text-xs border border-brand-purple text-brand-purple rounded-md hover:bg-brand-purple hover:text-white transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </fieldset>

      <div className="border-t border-brand-rose/30" />

      {/* Legend */}
      <fieldset className="border-none p-0 m-0">
        <legend className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-2">
          Color Legend
        </legend>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-xs text-gray-600">Green: Fit Score ≥ 50</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="text-xs text-gray-600">Orange: Fit Score 30–49</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span className="text-xs text-gray-600">Red: Fit Score &lt; 30</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            <span className="text-xs text-gray-600">Gray: Insufficient data</span>
          </div>
        </div>
      </fieldset>

      <div className="border-t border-brand-rose/30" />

      {/* Scoring explanation */}
      <fieldset className="border-none p-0 m-0">
        <legend className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-2">
          How Fit Score Works
        </legend>
        <p className="text-xs text-gray-500 leading-relaxed mb-1.5">
          Fit Score is a weighted average of three sub-scores:
        </p>
        <ul className="text-xs text-gray-500 leading-relaxed pl-4 space-y-1 list-disc">
          <li><strong className="text-gray-700">Step2 Fit ({displayWeights.step2}%)</strong> — How well your score matches the program's range.</li>
          <li><strong className="text-gray-700">IMG Friendliness ({displayWeights.img}%)</strong> — The program's US IMG acceptance rate scaled to 0–100.</li>
          <li><strong className="text-gray-700">Tech Hub Proximity ({displayWeights.proximity}%)</strong> — 100 if adjacent to a tech hub, 0 at 150+ miles away.</li>
        </ul>
        <p className="text-xs text-gray-500 leading-relaxed mt-1.5">
          If a sub-score can't be computed (missing data), its weight is redistributed to the others.
        </p>
      </fieldset>

      {/* Export Favorites */}
      <ExportButton />
    </div>
  );
}
