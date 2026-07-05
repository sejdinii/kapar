import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  BookingDto,
  BookingListResponse,
  BookingListTab,
  BookingSource,
  CreateBookingRequest,
} from '@kapar/shared-types';
import { NetworkError } from '../../../shared/api/client';
import {
  cancelBooking,
  createBooking,
  getBooking,
  listBookings,
} from '../../../shared/api/endpoints';
import { enqueueReservation } from '../../../shared/api/queue';

/** Booking data hooks (B3/B5/B6). Server issues every number; hooks only move data. */

export function useBookingsList(
  venueId: string | undefined,
  tab: BookingListTab,
  q: string,
  source: BookingSource | undefined,
): UseQueryResult<BookingListResponse> {
  return useQuery({
    queryKey: ['bookings', venueId, tab, q, source],
    queryFn: () => listBookings(venueId as string, tab, q.length > 0 ? q : undefined, source),
    enabled: venueId !== undefined,
  });
}

export function useBooking(bookingId: string): UseQueryResult<BookingDto> {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => getBooking(bookingId),
  });
}

export type CreateBookingResult =
  | { queued: false; booking: BookingDto }
  | { queued: true };

/**
 * B3 save. Online → create; offline (NetworkError) → enqueue with the SAME
 * clientRequestId so a later replay is idempotent, and confirm instantly with a
 * visible "pending sync" state (SPEC B3 offline rule). SLOT_TAKEN propagates to the
 * screen for the conflict card.
 */
export function useCreateBooking(
  venueId: string | undefined,
): UseMutationResult<CreateBookingResult, Error, CreateBookingRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateBookingRequest): Promise<CreateBookingResult> => {
      if (venueId === undefined) {
        throw new Error('No active venue');
      }
      try {
        const booking = await createBooking(venueId, req);
        return { queued: false, booking };
      } catch (err) {
        if (err instanceof NetworkError) {
          await enqueueReservation(venueId, req);
          return { queued: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['daySheet'] });
    },
  });
}

export function useCancelBooking(): UseMutationResult<BookingDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => cancelBooking(bookingId),
    onSuccess: (booking) => {
      queryClient.setQueryData(['booking', booking.id], booking);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['daySheet'] });
    },
  });
}
