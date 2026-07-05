import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Money } from '@kapar/shared-types';
import { useSession } from '../../../shared/auth/session';
import { Button, Card, Screen, StatusPill } from '../../../shared/design-system/components';
import { color, fontSize, spacing } from '../../../shared/design-system/tokens';
import { useBooking, useCancelBooking } from '../hooks/useBookings';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * B6 (M1 subset) — one booking, complete. Amounts are rendered exactly as the server
 * issued them; the /100 below is DISPLAY formatting of minor units, not price math (Law #3).
 */

const MINOR_PER_MAJOR = 100;

function formatMoney(money: Money | null): string {
  if (money === null) {
    return '—';
  }
  return `${(money.minor / MINOR_PER_MAJOR).toFixed(2)} ${money.currency}`;
}

const SOURCE_LABEL: Record<string, string> = {
  app: 'App',
  phone: 'Phone',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  walkin: 'Walk-in',
  other: 'Other',
};

type Props = NativeStackScreenProps<RootStackParamList, 'BookingDetail'>;

export function BookingDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { data: booking, isLoading } = useBooking(route.params.bookingId);
  const cancel = useCancelBooking();
  const { activeVenue } = useSession();
  const canCancel = activeVenue?.myRole === 'owner' || activeVenue?.myRole === 'manager';

  const confirmCancel = (): void => {
    Alert.alert(
      'Cancel this booking?',
      'The date becomes available again immediately. This cannot be undone.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () => {
            cancel.mutate(route.params.bookingId, {
              onSuccess: () => navigation.goBack(),
              onError: () => Alert.alert('Could not cancel', 'Please try again.'),
            });
          },
        },
      ],
    );
  };

  if (isLoading || booking === undefined) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator style={styles.loader} color={color.primary} />
      </Screen>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Date', value: booking.eventDate },
    {
      label: 'Time',
      value:
        booking.startTime !== null && booking.endTime !== null
          ? `${booking.startTime} – ${booking.endTime}`
          : '—',
    },
    { label: 'Hall', value: booking.hallName },
    { label: 'Guests', value: booking.guests !== null ? String(booking.guests) : '—' },
    { label: 'Phone', value: booking.customerPhone },
    { label: 'Source', value: SOURCE_LABEL[booking.source] ?? booking.source },
    { label: 'Kapar amount', value: formatMoney(booking.kaparAmount) },
    { label: 'Kapar received', value: formatMoney(booking.kaparReceived) },
    { label: 'Booking ID', value: booking.bookingRef },
  ];

  return (
    <Screen>
      <Text style={styles.name} accessibilityRole="header">
        {booking.customerName}
      </Text>
      <View style={styles.pillRow}>
        <StatusPill status={booking.status} />
      </View>

      <Card>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
        {booking.notes.length > 0 ? (
          <View style={styles.notes}>
            <Text style={styles.rowLabel}>Notes</Text>
            <Text style={styles.notesText}>{booking.notes}</Text>
          </View>
        ) : null}
      </Card>

      <Text style={styles.editNote}>Editing details arrives in M2 — cancel and re-add if something is wrong.</Text>

      {canCancel && (booking.status === 'CONFIRMED' || booking.status === 'PENDING_VENUE') ? (
        <Button label="Cancel booking" variant="destructive" onPress={confirmCancel} loading={cancel.isPending} style={styles.cancelButton} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  name: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary },
  pillRow: { marginTop: spacing.sm, marginBottom: spacing.lg, flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  rowLabel: { fontSize: fontSize.body, color: color.textSecondary },
  rowValue: { fontSize: fontSize.body, fontWeight: '600', color: color.textPrimary },
  notes: { paddingTop: spacing.sm },
  notesText: { fontSize: fontSize.body, color: color.textPrimary, marginTop: spacing.xs },
  editNote: {
    fontSize: fontSize.caption,
    color: color.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  cancelButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
