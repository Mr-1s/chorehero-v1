/**
 * Regression test for `notificationService.markAsRead`.
 *
 * Scenario: the user opens a server-side notification (id starts with `db:`)
 * and we call `update({ is_read: true })` on Supabase. The previous
 * implementation wrapped the call in try/catch but never destructured `error`,
 * so an RLS / network failure was silently treated as success and the badge
 * count kept showing the unread state until the next focus refresh.
 *
 * Expected behavior after the fix:
 *   - When supabase returns `{ error }`, `markAsRead` resolves to `false`.
 *   - When supabase returns `{ error: null }`, it resolves to `true`.
 *
 * Callers (`NotificationsScreen`) use the boolean to decide whether to
 * roll back the optimistic UI.
 */

// Jest hoists `jest.mock` factories above imports. To reference a mock from the
// test body, the variable name must start with `mock` (jest's allowlist).
const mockUpdateEq = jest.fn();

// AsyncStorage's native module isn't loaded under jest, so stub it here.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiRemove: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: () => ({
        eq: (...args: unknown[]) => mockUpdateEq(...args),
      }),
    })),
  },
}));

import { notificationService } from '../../src/services/notificationService';

describe('notificationService.markAsRead — silent-error regression', () => {
  beforeEach(() => {
    mockUpdateEq.mockReset();
  });

  it('returns false when the supabase update returns an error', async () => {
    mockUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });

    const ok = await notificationService.markAsRead('db:abc-123');
    expect(ok).toBe(false);
  });

  it('returns true when the supabase update succeeds', async () => {
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });

    const ok = await notificationService.markAsRead('db:abc-123');
    expect(ok).toBe(true);
  });
});
