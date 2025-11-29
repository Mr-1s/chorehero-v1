import { supabase } from './supabase';

export interface CreatePaymentIntentParams {
  bookingId: string;
  cleanerAccountId: string;
  subtotal_cents: number;
  tip_cents?: number;
  add_ons_cents?: number;
  discount_cents?: number;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  amount_cents: number;
  customer_fee_cents: number;
  platform_fee_cents: number;
}

/**
 * Calls the Supabase Edge function `create-payment-intent` to create a Stripe PaymentIntent
 * for a booking. This returns a client secret along with calculated fees so the
 * client can present a PaymentSheet.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResponse> {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: params,
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to create payment intent');
  }

  return data as PaymentIntentResponse;
}
