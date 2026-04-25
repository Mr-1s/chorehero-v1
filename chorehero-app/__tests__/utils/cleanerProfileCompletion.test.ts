/**
 * Regression test for the cleaner profile-completion derivation.
 *
 * The derivation lives in `src/utils/cleanerProfileCompletion.ts` and is
 * consumed by:
 *   - `cleanerStore.fetchDashboard` (computes the ratio)
 *   - `DashboardScreen` (renders the checklist on the dashboard)
 *   - `JobsScreenNew` (gates job lists behind completion)
 *
 * Any change to `FIELD_SPECS` should be matched by a test here so the
 * dashboard checklist stays in sync with what's actually required.
 */

import {
  computeProfileCompletionRatio,
  getProfileCompletionFields,
  mergeUserForProfileCompletion,
} from '../../src/utils/cleanerProfileCompletion';

describe('cleanerProfileCompletion', () => {
  it('returns 0 when no profile is provided', () => {
    expect(computeProfileCompletionRatio(null, null)).toBe(0);
    const fields = getProfileCompletionFields(null, null);
    expect(fields.every((f) => f.filled === false)).toBe(true);
    expect(fields.length).toBeGreaterThan(0);
  });

  it('marks avatar filled only when the merged user row carries an avatar_url', () => {
    const profile = { bio: 'Long bio that meets the minimum length requirement', hourly_rate: 25 };
    const fieldsWithoutAvatar = getProfileCompletionFields(profile, { avatar_url: null });
    expect(fieldsWithoutAvatar.find((f) => f.id === 'avatar')?.filled).toBe(false);

    const fieldsWithAvatar = getProfileCompletionFields(profile, { avatar_url: 'https://x/y.jpg' });
    expect(fieldsWithAvatar.find((f) => f.id === 'avatar')?.filled).toBe(true);
  });

  it('counts background check filled when status is cleared OR verified OR a date is set', () => {
    const baseUser = { avatar_url: 'https://x/y.jpg' };
    const cases = [
      { background_check_status: 'cleared' },
      { background_check_status: 'verified' },
      { background_check_date: '2025-01-01T00:00:00Z' },
    ];
    for (const profile of cases) {
      const fields = getProfileCompletionFields(profile, baseUser);
      expect(fields.find((f) => f.id === 'background')?.filled).toBe(true);
    }

    const incomplete = getProfileCompletionFields(
      { background_check_status: 'pending' },
      baseUser
    );
    expect(incomplete.find((f) => f.id === 'background')?.filled).toBe(false);
  });

  it('rejects bios shorter than 11 characters', () => {
    const fields = getProfileCompletionFields({ bio: 'too short' }, { avatar_url: 'x' });
    expect(fields.find((f) => f.id === 'bio')?.filled).toBe(false);
  });

  it('produces a ratio in [0, 1]', () => {
    const profile = {
      bio: 'A bio that is definitely long enough to pass the minimum length check',
      hourly_rate: 30,
      specialties: ['Deep Cleaning'],
      years_experience: 2,
      coverage_area: 'Savannah',
      verification_status: 'verified',
      background_check_status: 'cleared',
      video_profile_url: 'https://x/y.mp4',
    };
    const ratio = computeProfileCompletionRatio(profile, { avatar_url: 'x' });
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });

  it('mergeUserForProfileCompletion prefers DB row but falls back to app user', () => {
    const merged = mergeUserForProfileCompletion(
      { avatar_url: null, name: 'DB Name' },
      { avatar_url: 'https://app/x.jpg', name: 'App Name', email: 'test@example.com' }
    );
    expect(merged.avatar_url).toBe('https://app/x.jpg');
    expect(merged.name).toBe('DB Name');
    expect(merged.email).toBe('test@example.com');
  });
});
