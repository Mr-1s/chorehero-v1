/**
 * Regression test for `jobQuoteService.createJob`.
 *
 * Scenario: the `jobs` insert succeeds but the follow-up `job_media` insert
 * fails (RLS / constraint / network blip). The previous behavior swallowed
 * that error and reported pure success, so the customer's job appeared in
 * Bookings without any of the photos/videos they attached.
 *
 * Expected behavior after the fix:
 *   - `success` is `true` (the job row exists)
 *   - `data` is the inserted job
 *   - `error` is set to a human-readable message describing the media failure
 *
 * Test approach: stub `supabase.from(...).insert(...).select().single()` for
 * the `jobs` call and `supabase.from('job_media').insert(...)` to return an
 * error, then assert the returned envelope.
 */

jest.mock('../../src/services/supabase', () => {
  const insertedJob = {
    id: 'job_test_1',
    customer_id: 'cust_test_1',
    headline: 'Test job',
    category: 'cleaning',
    urgency: 'this_week',
    status: 'open',
  };

  // Builders used per `from(table)` call. Each table chain returns its own mock
  // so the success-or-fail behavior matches the production code paths.
  const fromImpl = (table: string) => {
    if (table === 'jobs') {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: insertedJob, error: null }),
          }),
        }),
      };
    }
    if (table === 'job_media') {
      return {
        insert: () =>
          Promise.resolve({
            data: null,
            error: { message: 'job_media RLS denied insert', code: '42501' },
          }),
      };
    }
    throw new Error(`Unexpected from(${table}) in test`);
  };

  return {
    supabase: {
      from: jest.fn(fromImpl),
    },
  };
});

import { jobQuoteService } from '../../src/services/jobQuoteService';

describe('jobQuoteService.createJob — silent-error regression', () => {
  it('returns success with a non-fatal error when job_media insert fails', async () => {
    const res = await jobQuoteService.createJob('cust_test_1', {
      headline: 'Test job',
      category: 'cleaning',
      urgency: 'this_week',
      media_urls: [{ url: 'https://example.com/a.jpg', type: 'photo' }],
    } as any);

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe('job_test_1');
    expect(typeof res.error).toBe('string');
    expect(res.error).toMatch(/media/i);
  });
});
