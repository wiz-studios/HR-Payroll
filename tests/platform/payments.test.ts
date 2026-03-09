import { describe, expect, it } from 'vitest';
import {
  BATCH_TRANSITIONS,
  canTransitionPaymentBatchStatus,
  getPaymentBatchItemStatus,
} from '@/lib/platform/payments';

describe('payment batch state helpers', () => {
  it('allows only defined batch transitions', () => {
    expect(canTransitionPaymentBatchStatus('draft', 'exported')).toBe(true);
    expect(canTransitionPaymentBatchStatus('exported', 'submitted')).toBe(true);
    expect(canTransitionPaymentBatchStatus('submitted', 'reconciled')).toBe(true);
    expect(canTransitionPaymentBatchStatus('draft', 'reconciled')).toBe(false);
    expect(BATCH_TRANSITIONS.failed).toEqual(['draft']);
  });

  it('maps batch status to batch-item status', () => {
    expect(getPaymentBatchItemStatus('draft')).toBe('pending');
    expect(getPaymentBatchItemStatus('exported')).toBe('pending');
    expect(getPaymentBatchItemStatus('submitted')).toBe('submitted');
    expect(getPaymentBatchItemStatus('reconciled')).toBe('reconciled');
    expect(getPaymentBatchItemStatus('failed')).toBe('failed');
  });
});
