import type {
  AuthTokens,
  BookingDto,
  BookingListResponse,
  BookingListTab,
  BookingSource,
  CalendarMonthResponse,
  CreateBlockRequest,
  CreateBlockResponse,
  CreateBookingRequest,
  CreateVenueRequest,
  DaySheetResponse,
  OtpSendResponse,
  OtpVerifyResponse,
  VenueDto,
} from '@kapar/shared-types';
import { getRefreshToken, request } from './client';

/** Typed endpoint functions — the M1 API surface (M1-CONTRACT §4), nothing more. */

// ── auth ─────────────────────────────────────────────────────────────────────────────────────

export function otpSend(phone: string): Promise<OtpSendResponse> {
  return request('/auth/otp/send', { method: 'POST', body: { phone }, auth: false });
}

export function otpVerify(phone: string, code: string): Promise<OtpVerifyResponse> {
  return request('/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false });
}

export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return request('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken !== null) {
    await request('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
  }
}

// ── venues ───────────────────────────────────────────────────────────────────────────────────

export function getMyVenues(): Promise<VenueDto[]> {
  return request('/business/venues');
}

export function createVenue(req: CreateVenueRequest): Promise<VenueDto> {
  return request('/venues', { method: 'POST', body: req });
}

// ── calendar ─────────────────────────────────────────────────────────────────────────────────

export function getCalendarMonth(venueId: string, month: string): Promise<CalendarMonthResponse> {
  return request(`/business/venues/${venueId}/calendar?month=${encodeURIComponent(month)}`);
}

export function getDaySheet(venueId: string, date: string): Promise<DaySheetResponse> {
  return request(`/business/venues/${venueId}/calendar/day?date=${encodeURIComponent(date)}`);
}

export function createBlock(venueId: string, req: CreateBlockRequest): Promise<CreateBlockResponse> {
  return request(`/business/venues/${venueId}/blocks`, { method: 'POST', body: req });
}

export function deleteBlock(blockId: string): Promise<{ ok: true }> {
  return request(`/business/blocks/${blockId}`, { method: 'DELETE' });
}

// ── bookings ─────────────────────────────────────────────────────────────────────────────────

export function createBooking(venueId: string, req: CreateBookingRequest): Promise<BookingDto> {
  return request(`/business/venues/${venueId}/bookings`, { method: 'POST', body: req });
}

export function listBookings(
  venueId: string,
  tab: BookingListTab,
  q?: string,
  source?: BookingSource,
): Promise<BookingListResponse> {
  const params = new URLSearchParams({ tab });
  if (q !== undefined && q.length > 0) {
    params.set('q', q);
  }
  if (source !== undefined) {
    params.set('source', source);
  }
  return request(`/business/venues/${venueId}/bookings?${params.toString()}`);
}

export function getBooking(bookingId: string): Promise<BookingDto> {
  return request(`/business/bookings/${bookingId}`);
}

export function cancelBooking(bookingId: string): Promise<BookingDto> {
  return request(`/business/bookings/${bookingId}/cancel`, { method: 'POST' });
}
