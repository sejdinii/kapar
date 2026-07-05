import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BookingListTab, BookingSource, BookingSummaryDto } from '@kapar/shared-types';
import { useOfflineQueue } from '../../../shared/api/queue';
import { useSession } from '../../../shared/auth/session';
import {
  Card,
  Chip,
  kaparPaidCopy,
  Screen,
  StatusPill,
  TextField,
} from '../../../shared/design-system/components';
import { color, fontSize, MIN_TAP_TARGET, radius, spacing } from '../../../shared/design-system/tokens';
import { useBookingsList } from '../hooks/useBookings';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * B5 — My Bookings (business): every booking, every source, one list.
 * Tabs, search by name/phone, source filter; unpaid-kapar rows carry an amber edge.
 * The offline queue's pending/conflict state is surfaced at the top — never hidden.
 */

const TABS: Array<{ key: BookingListTab; label: string }> = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SOURCE_FILTERS: Array<{ key: BookingSource; label: string }> = [
  { key: 'phone', label: 'Phone' },
  { key: 'viber', label: 'Viber' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'walkin', label: 'Walk-in' },
];

const SEARCH_DEBOUNCE_MS = 300;

const MONTH_ABBREV = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function dateBlock(eventDate: string): { month: string; day: string } {
  const monthIndex = Number(eventDate.slice(5, 7)) - 1;
  return { month: MONTH_ABBREV[monthIndex] ?? '???', day: eventDate.slice(8, 10) };
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function BookingsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { activeVenue } = useSession();
  const [tab, setTab] = useState<BookingListTab>('upcoming');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<BookingSource | undefined>(undefined);
  const queue = useOfflineQueue();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any surviving queued reservations get a sync attempt whenever this list opens.
  useEffect(() => {
    if (queue.pendingCount > 0) {
      void queue.flush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useBookingsList(activeVenue?.id, tab, search, source);
  const bookings = list.data?.bookings ?? [];

  const renderRow = ({ item }: { item: BookingSummaryDto }): React.JSX.Element => {
    const { month, day } = dateBlock(item.eventDate);
    const paid = kaparPaidCopy(item.kaparPaidState);
    const unpaidEdge = item.kaparPaidState !== 'yes' && tab === 'upcoming';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Booking ${item.customerName}, ${item.eventDate}, ${paid.label}`}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
      >
        <Card style={[styles.row, unpaidEdge && styles.rowUnpaid]}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateMonth}>{month}</Text>
            <Text style={styles.dateDay}>{day}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>{item.customerName}</Text>
            <Text style={styles.rowMeta}>
              {item.hallName}
              {item.guests !== null ? ` · ${item.guests} guests` : ''}
            </Text>
            <Text style={[styles.rowKapar, { color: paid.tint }]}>{paid.label}</Text>
          </View>
          <StatusPill status={item.status} />
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          My Bookings
        </Text>

        {queue.pendingCount > 0 ? (
          <Card style={styles.queueCard}>
            <Text style={styles.queueText}>
              {queue.pendingCount} reservation{queue.pendingCount > 1 ? 's' : ''} waiting to sync
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Sync now" onPress={() => void queue.flush()} style={styles.queueAction}>
              <Text style={styles.queueActionText}>Sync now</Text>
            </Pressable>
          </Card>
        ) : null}
        {queue.conflicts.map((c, i) => (
          <Card key={`${c.reservation.request.clientRequestId}`} style={styles.conflictCard}>
            <Text style={styles.conflictTitle}>Could not sync — date taken</Text>
            <Text style={styles.conflictBody}>
              {c.reservation.request.customerName} · {c.reservation.request.eventDate} — {c.holderLabel}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss conflict" onPress={() => void queue.dismissConflict(i)} style={styles.queueAction}>
              <Text style={styles.queueActionText}>Dismiss</Text>
            </Pressable>
          </Card>
        ))}

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              accessibilityLabel={t.label}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <TextField label="Search" value={searchInput} onChangeText={setSearchInput} placeholder="Name or phone" />
        <View style={styles.sourceRow}>
          {SOURCE_FILTERS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              selected={source === s.key}
              onPress={() => setSource((cur) => (cur === s.key ? undefined : s.key))}
            />
          ))}
        </View>
      </View>

      {list.isLoading ? (
        <ActivityIndicator style={styles.loader} color={color.primary} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'upcoming'
                ? 'No upcoming bookings yet. Tap [+] to add your first reservation.'
                : tab === 'completed'
                  ? 'Completed events will appear here.'
                  : 'No cancellations. Good sign.'}
            </Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: 0 },
  title: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary, marginBottom: spacing.md },
  queueCard: { marginBottom: spacing.md, backgroundColor: color.primaryWash },
  queueText: { fontSize: fontSize.body, color: color.textPrimary, fontWeight: '600' },
  queueAction: { minHeight: MIN_TAP_TARGET, justifyContent: 'center' },
  queueActionText: { color: color.primary, fontWeight: '700', fontSize: fontSize.body },
  conflictCard: { marginBottom: spacing.md, borderWidth: 1, borderColor: color.danger },
  conflictTitle: { fontSize: fontSize.body, fontWeight: '700', color: color.danger },
  conflictBody: { fontSize: fontSize.body, color: color.textPrimary, marginTop: spacing.xs },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md },
  tab: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: color.border,
  },
  tabActive: { borderBottomColor: color.primary },
  tabText: { fontSize: fontSize.body, color: color.textSecondary, fontWeight: '600' },
  tabTextActive: { color: color.primary },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap' },
  loader: { marginTop: spacing.xl },
  listBody: { padding: spacing.lg, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  rowUnpaid: { borderLeftWidth: 3, borderLeftColor: color.pending },
  dateBlock: {
    width: 52,
    alignItems: 'center',
    marginRight: spacing.md,
    borderRadius: radius.card,
    backgroundColor: color.primaryWash,
    paddingVertical: spacing.sm,
  },
  dateMonth: { fontSize: fontSize.caption, fontWeight: '800', color: color.danger },
  dateDay: { fontSize: fontSize.title, fontWeight: '800', color: color.textPrimary },
  rowBody: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: fontSize.body, fontWeight: '700', color: color.textPrimary },
  rowMeta: { fontSize: fontSize.caption, color: color.textSecondary, marginTop: 2 },
  rowKapar: { fontSize: fontSize.caption, fontWeight: '700', marginTop: 2 },
  empty: {
    textAlign: 'center',
    color: color.textSecondary,
    fontSize: fontSize.body,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
