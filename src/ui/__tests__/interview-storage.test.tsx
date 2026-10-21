import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { AppStateProvider } from '../AppState';
import { InterviewProvider, useInterviews } from '../InterviewState';
import { INTERVIEW_BACKUP_KEY, INTERVIEW_STORAGE_KEY } from '../../core/interview-store';

const SAVED = {
  records: {
    'Family Medicine|g1': {
      key: 'Family Medicine|g1', name: 'Saved FM', specialty: 'Family Medicine', city: 'Kennewick', state: 'WA',
      status: 'completed', date: '2026-10-05', time: '05:00', format: 'virtual', scheduleNotes: '',
      ratings: { location: 4 }, criterionNotes: {}, pros: 'p', cons: 'c', overall: 'o', createdAt: 1, updatedAt: 1,
    },
  },
  matches: [{ id: 'm1', winner: 'Family Medicine|g1', loser: 'x', note: 'why', at: 1 }],
};

function Probe() {
  const { data, actions } = useInterviews();
  return (
    <div>
      <div data-testid="names">{Object.values(data.records).map((r) => r.name).join(',')}</div>
      <button onClick={() => actions.updateRecord('Family Medicine|g1', { pros: 'edited' })}>edit</button>
    </div>
  );
}

function mount() {
  return render(
    <AppStateProvider>
      <InterviewProvider>
        <Probe />
      </InterviewProvider>
    </AppStateProvider>,
  );
}

describe('interview storage safety', () => {
  beforeEach(() => localStorage.clear());

  it('loading, remounting, and unmounting never rewrite saved data', () => {
    const raw = JSON.stringify(SAVED);
    localStorage.setItem(INTERVIEW_STORAGE_KEY, raw);
    const a = mount();
    expect(screen.getByTestId('names').textContent).toBe('Saved FM');
    a.unmount();
    mount().unmount();
    expect(localStorage.getItem(INTERVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('a stale tab with empty data does not wipe data saved by another tab', () => {
    // This tab opens before anything is saved.
    mount();
    expect(screen.getByTestId('names').textContent).toBe('');
    // Another tab saves interviews…
    const raw = JSON.stringify(SAVED);
    localStorage.setItem(INTERVIEW_STORAGE_KEY, raw);
    // …and this tab is told about it.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: INTERVIEW_STORAGE_KEY, newValue: raw }));
    });
    expect(screen.getByTestId('names').textContent).toBe('Saved FM');
    // Adopting the other tab's data doesn't write it back.
    expect(localStorage.getItem(INTERVIEW_STORAGE_KEY)).toBe(raw);
    // An edit here now builds on the other tab's data instead of replacing it.
    fireEvent.click(screen.getByText('edit'));
    const stored = JSON.parse(localStorage.getItem(INTERVIEW_STORAGE_KEY)!);
    expect(Object.keys(stored.records)).toEqual(['Family Medicine|g1']);
    expect(stored.records['Family Medicine|g1'].pros).toBe('edited');
    expect(stored.matches).toHaveLength(1);
  });

  it('unreadable saved data is backed up and not overwritten on load', () => {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, '{not json');
    mount();
    expect(localStorage.getItem(INTERVIEW_BACKUP_KEY)).toBe('{not json');
    expect(localStorage.getItem(INTERVIEW_STORAGE_KEY)).toBe('{not json');
  });

  it('ignores unrelated storage keys and unreadable updates from other tabs', () => {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(SAVED));
    mount();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'favorites', newValue: '[]' }));
      window.dispatchEvent(new StorageEvent('storage', { key: INTERVIEW_STORAGE_KEY, newValue: '{bad' }));
    });
    expect(screen.getByTestId('names').textContent).toBe('Saved FM');
  });
});
