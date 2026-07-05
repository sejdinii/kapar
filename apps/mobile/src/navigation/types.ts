/**
 * Navigation contract (M1-CONTRACT §7) — param lists shared by every screen.
 * Dates travel as YYYY-MM-DD strings; ids are server uuids.
 */

export type RootStackParamList = {
  Welcome: undefined;
  Otp: { phone: string };
  Onboarding: undefined;
  BusinessTabs: undefined;
  AddReservation: { venueId: string; hallId?: string; date?: string };
  BookingDetail: { bookingId: string };
  BlockDate: { venueId: string; hallId?: string; date?: string };
};

export type BusinessTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  AddTab: undefined;
  Bookings: undefined;
  More: undefined;
};
