import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useEffect } from 'react';

import { AppStateProvider, useAppState } from '../AppState';
import { InterviewProvider, useInterviews } from '../InterviewState';
import { InterviewEditor } from '../InterviewEditor';
import { CompareGame } from '../CompareGame';
import { loadScrapedPrograms, type ScrapedProgram } from '../../core/scraped-data-loader';
import type { CityDataset } from '../../core/geocoder';
import { CRITERIA } from '../../core/interview-criteria';
import { INTERVIEW_STORAGE_KEY } from '../../core/interview-store';

const fm = loadScrapedPrograms(
  [{ guid: 'fm-1', url: 'u', name: 'Alpha FM', city: 'A', state: 'CA' } as ScrapedProgram],
  {} as CityDataset,
  'Family Medicine',
).programs;
const im = loadScrapedPrograms(
  [{ guid: 'im-1', url: 'u', name: 'Beta IM', city: 'B', state: 'NY' } as ScrapedProgram],
  {} as CityDataset,
  'Internal Medicine',
).programs;
const PROGRAMS = [...fm, ...im];

function Seed() {
  const { actions } = useAppState();
  useEffect(() => {
    actions.setPrograms(PROGRAMS);
  }, [actions]);
  return null;
}

function Harness() {
  const { derived } = useAppState();
  const { ranked, data, compareOpen, setCompareOpen, actions } = useInterviews();
  const programs = derived.scoredPrograms;
  return (
    <div>
      <div data-testid="ranked">{ranked.map((e) => e.record.name).join(',')}</div>
      <div data-testid="matches">{data.matches.length}</div>
      <button onClick={() => programs.forEach((p) => actions.addInterview(p))}>add-all</button>
      <button onClick={() => setCompareOpen(true)}>open-compare</button>
      {programs.map((p) => (
        <div key={p.id} data-testid={`editor-${p.name}`}>
          <InterviewEditor program={p} />
        </div>
      ))}
      {compareOpen && <CompareGame />}
    </div>
  );
}

function renderApp() {
  return render(
    <AppStateProvider>
      <InterviewProvider>
        <Seed />
        <Harness />
      </InterviewProvider>
    </AppStateProvider>,
  );
}

function rateAll(programName: string, score: number) {
  const editor = screen.getByTestId(`editor-${programName}`);
  fireEvent.click(within(editor).getByRole('button', { name: /Rate program|Edit ratings/ }));
  const dialog = screen.getByRole('dialog', { name: `Rate ${programName}` });
  for (const c of CRITERIA) {
    const group = within(dialog).getByRole('group', { name: `${c.label} score` });
    fireEvent.click(within(group).getByRole('button', { name: String(score) }));
  }
  fireEvent.change(within(dialog).getByLabelText('Location notes'), { target: { value: `notes for ${programName}` } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
}

describe('interview flow', () => {
  beforeEach(() => localStorage.clear());

  it('adds FM + IM interviews, rates them, ranks across specialties, and compares', () => {
    renderApp();
    fireEvent.click(screen.getByText('add-all'));

    // Both editors now show interview controls.
    expect(within(screen.getByTestId('editor-Alpha FM')).getByText(/Rated 0\/15/)).toBeTruthy();

    rateAll('Alpha FM', 3);
    rateAll('Beta IM', 5);

    // Fully rated → ranked in one combined list. Ratings don't affect Elo:
    // both start at 1500, so the tie falls back to name order.
    expect(screen.getByTestId('ranked').textContent).toBe('Alpha FM,Beta IM');
    expect(within(screen.getByTestId('editor-Beta IM')).getByText(/Elo 1500/)).toBeTruthy();

    // Picks alone decide the order: favor the lower-rated program.
    fireEvent.click(screen.getByText('open-compare'));
    for (let i = 0; i < 6; i++) {
      const game = screen.getByRole('dialog', { name: 'Compare programs' });
      const headers = within(game).getAllByRole('button', { name: /Rank this higher/ });
      // Find which side is Alpha FM and pick it.
      const alphaIsLeft = within(game).getAllByText(/Alpha FM|Beta IM/)[0].textContent === 'Alpha FM';
      fireEvent.change(within(game).getByLabelText('Comparison note'), { target: { value: 'better fit' } });
      fireEvent.click(headers[alphaIsLeft ? 0 : 1]);
    }
    expect(screen.getByTestId('matches').textContent).toBe('6');
    expect(screen.getByTestId('ranked').textContent).toBe('Alpha FM,Beta IM');

    // Undo restores the last pair and removes one match.
    act(() => {
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Compare programs' })).getByRole('button', { name: /Undo last/ }));
    });
    expect(screen.getByTestId('matches').textContent).toBe('5');

    // Persisted to localStorage with notes.
    const stored = JSON.parse(localStorage.getItem(INTERVIEW_STORAGE_KEY)!);
    expect(Object.keys(stored.records)).toHaveLength(2);
    expect(stored.matches).toHaveLength(5);
    expect(stored.matches[0].note).toBe('better fit');
    const alpha = Object.values(stored.records).find((r: any) => r.name === 'Alpha FM') as any;
    expect(alpha.criterionNotes.location).toBe('notes for Alpha FM');
    expect(alpha.status).toBe('completed');
  });

  it('restores saved interviews on reload', () => {
    const first = renderApp();
    fireEvent.click(screen.getByText('add-all'));
    rateAll('Alpha FM', 5);
    first.unmount();

    renderApp();
    expect(within(screen.getByTestId('editor-Alpha FM')).getByText(/Rated 15\/15/)).toBeTruthy();
  });
});
