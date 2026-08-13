/**
 * FilterPanel component.
 *
 * Controls for all filters (specialty, state, region, min Fit_Score,
 * min IMG_Friendliness, max city distance, Step 2 compatibility),
 * a clear-all action, applicant score input (default 223), and three
 * weight sliders with "reset to 40/40/20" and a minimum guard against
 * all-zero weights. Displayed weights renormalize to 100%.
 *
 * Requirements: 4.6, 7.3, 8.1, 8.2, 8.3
 */

import { useMemo, type ChangeEvent } from 'react';
import type { Specialty } from '../core/types';
import { useAppState } from './AppState';
import { ExportButton } from './ExportButton';

export function FilterPanel() {
  const { applicantScore, matchWeights, filters, derived, actions } = useAppState();

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

  const handleMaxCityDistanceChange = (e: ChangeEvent<HTMLInputElement>) => {
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
            <label htmlFor="weight-scoreFit" className="block text-xs text-gray-600 mb-0.5">
              Score Fit: {matchWeights.scoreFit}
            </label>
            <input
              id="weight-scoreFit"
              type="range"
              min={0}
              max={50}
              step={5}
              value={matchWeights.scoreFit}
              onChange={(e) => actions.setMatchWeights({ ...matchWeights, scoreFit: Number(e.target.value) })}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-imgRate" className="block text-xs text-gray-600 mb-0.5">
              IMG Interview Rate: {matchWeights.imgInterviewRate}
            </label>
            <input
              id="weight-imgRate"
              type="range"
              min={0}
              max={50}
              step={5}
              value={matchWeights.imgInterviewRate}
              onChange={(e) => actions.setMatchWeights({ ...matchWeights, imgInterviewRate: Number(e.target.value) })}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-selectivity" className="block text-xs text-gray-600 mb-0.5">
              Selectivity: {matchWeights.selectivity}
            </label>
            <input
              id="weight-selectivity"
              type="range"
              min={0}
              max={50}
              step={5}
              value={matchWeights.selectivity}
              onChange={(e) => actions.setMatchWeights({ ...matchWeights, selectivity: Number(e.target.value) })}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-imgRep" className="block text-xs text-gray-600 mb-0.5">
              IMG Representation: {matchWeights.imgRepresentation}
            </label>
            <input
              id="weight-imgRep"
              type="range"
              min={0}
              max={50}
              step={5}
              value={matchWeights.imgRepresentation}
              onChange={(e) => actions.setMatchWeights({ ...matchWeights, imgRepresentation: Number(e.target.value) })}
              className="w-full accent-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="weight-cityProx" className="block text-xs text-gray-600 mb-0.5">
              Major City Proximity: {matchWeights.techHubProximity}
            </label>
            <input
              id="weight-cityProx"
              type="range"
              min={0}
              max={50}
              step={5}
              value={matchWeights.techHubProximity}
              onChange={(e) => actions.setMatchWeights({ ...matchWeights, techHubProximity: Number(e.target.value) })}
              className="w-full accent-brand-purple"
            />
          </div>
          <button
            type="button"
            onClick={() => actions.setMatchWeights({ scoreFit: 25, imgInterviewRate: 25, selectivity: 20, imgRepresentation: 15, techHubProximity: 15 })}
            className="w-full px-3 py-1.5 text-xs border border-brand-purple text-brand-purple rounded-md hover:bg-brand-purple hover:text-white transition-colors"
          >
            Reset to 25/25/20/15/15
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

          {/* Max Major City Distance */}
          <div>
            <label htmlFor="filter-max-distance" className="block text-xs text-gray-600 mb-1">
              Max City Distance (miles)
            </label>
            <input
              id="filter-max-distance"
              type="number"
              min={0}
              max={500}
              step={5}
              value={filters.maxTechHubDistance ?? ''}
              onChange={handleMaxCityDistanceChange}
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
          <li><strong className="text-gray-700">Score Fit ({matchWeights.scoreFit})</strong> — How well your Step 2 score fits the program's US IMG invited range.</li>
          <li><strong className="text-gray-700">IMG Interview Rate ({matchWeights.imgInterviewRate})</strong> — What % of US IMG applicants get interviews.</li>
          <li><strong className="text-gray-700">Selectivity ({matchWeights.selectivity})</strong> — Favorable ratio of positions to applicants for US IMGs.</li>
          <li><strong className="text-gray-700">IMG Representation ({matchWeights.imgRepresentation})</strong> — What % of current residents are US IMGs.</li>
          <li><strong className="text-gray-700">City Proximity ({matchWeights.techHubProximity})</strong> — 100 if adjacent to a major city, 0 at 150+ miles away.</li>
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
