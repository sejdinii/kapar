import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CalendarDay, DayHallState } from '@kapar/shared-types';
import { Button, Chip, Screen } from '../../../shared/design-system/components';
import { color, fontSize, MIN_TAP_TARGET, radius, spacing } from '../../../shared/design-system/tokens';
import { useSession } from '../../../shared/auth/session';
import {
  addMonths,
  buildMonthGrid,
  monthKey,
  monthLabel,
  todayISO,
  useCalendarMonth,
  useDaySheet,
  WEEKDAY_LABELS,
} from '../hooks/useCalendar';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * B2 — Calendar: the source of truth Couple Mode will read (Law #1).
 * Month grid, Monday-first; per-day aggregate across halls; tap a day → day sheet
 * with per-hall rows and the two quick actions (Add Reservation, Block).
 */

type DayAggregate = 'available' | 'limited' | 'booked' | 'blocked' | 'none';

/** Aggregate hall states for a day cell (SPEC B2 legend). */
export function aggregateDay(day: CalendarDay | undefined): DayAggregate {
  if (day === undefined || day.halls.length === 0) {
    return 'none';
  }
  const states = day.halls.map((h) => h.state);
  const claimed = states.filter((s) => s !== 'available').length;
  if (claimed === 0) {
    return 'available';
  }
  if (claimed < states.length) {
    return 'limited';
  }
  return states.every((s) => s === 'blocked') ? 'blocked' : 'booked';
}

const AGGREGATE_COLOR: Record<Exclude<DayAggregate, 'none'>, string> = {
  available: color.success,
  limited: color.pending,
  booked: color.danger,
  blocked: color.textSecondary,
};

const STATE_LABEL: Record<DayHallState, string> = {
  available: 'Available',
  booked: 'Booked',
  blocked: 'Blocked',
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CalendarScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { activeVenue } = useSession();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [hallFilter, setHallFilter] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  const calendar = useCalendarMonth(activeVenue?.id, month);
  const daySheet = useDaySheet(activeVenue?.id, sheetDate);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendar.data?.days ?? []) {
      const filtered =
        hallFilter === null
          ? day
          : { ...day, halls: day.halls.filter((h) => h.hallId === hallFilter) };
      map.set(day.date, filtered);
    }
    return map;
  }, [calendar.data, hallFilter]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const today = todayISO();

  if (activeVenue === null) {
    return (
      <Screen scroll={false}>
        <Text style={styles.emptyText}>Create your venue first.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={calendar.isRefetching} onRefresh={() => void calendar.refetch()} />
        }
        contentContainerStyle={styles.scrollBody}
      >
        {/* Month header */}
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => setMonth((m) => addMonths(m, -1))}
            style={styles.monthChevron}
          >
            <Text style={styles.monthChevronText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.monthTitle} accessibilityRole="header">
            {monthLabel(month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => setMonth((m) => addMonths(m, 1))}
            style={styles.monthChevron}
          >
            <Text style={styles.monthChevronText}>{'›'}</Text>
          </Pressable>
        </View>

        {/* Weekday header — Monday first (SPEC B2) */}
        <View style={styles.weekRow}>
          {WEEKDAY_LABELS.map((d) => (
            <Text key={d} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>

        {calendar.isLoading ? (
          <ActivityIndicator style={styles.loader} color={color.primary} />
        ) : (
          grid.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((cell) => {
                const agg = cell.inMonth ? aggregateDay(byDate.get(cell.date)) : 'none';
                const isToday = cell.date === today;
                return (
                  <Pressable
                    key={cell.date}
                    disabled={!cell.inMonth}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.date}, ${agg === 'none' ? 'outside month' : agg}`}
                    onPress={() => setSheetDate(cell.date)}
                    style={[styles.dayCell, isToday && styles.dayCellToday]}
                  >
                    <Text style={[styles.dayNumber, !cell.inMonth && styles.dayNumberMuted]}>
                      {Number(cell.date.slice(8, 10))}
                    </Text>
                    {agg !== 'none' && agg !== 'available' ? (
                      <View style={[styles.dayDot, { backgroundColor: AGGREGATE_COLOR[agg] }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {/* Legend */}
        <View style={styles.legendRow}>
          {(['available', 'limited', 'booked', 'blocked'] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.dayDot, { backgroundColor: AGGREGATE_COLOR[k] }]} />
              <Text style={styles.legendText}>{k[0]!.toUpperCase() + k.slice(1)}</Text>
            </View>
          ))}
        </View>

        {/* Hall filter (SPEC B2: hall tap filters the grid) */}
        <Text style={styles.hallsTitle}>Halls</Text>
        <View style={styles.hallChips}>
          <Chip label="All" selected={hallFilter === null} onPress={() => setHallFilter(null)} />
          {activeVenue.halls.map((h) => (
            <Chip
              key={h.id}
              label={h.name}
              selected={hallFilter === h.id}
              onPress={() => setHallFilter((cur) => (cur === h.id ? null : h.id))}
            />
          ))}
        </View>
      </ScrollView>

      {/* Day sheet — bottom modal (SPEC B2) */}
      <Modal
        visible={sheetDate !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetDate(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetDate(null)} accessibilityLabel="Close day sheet" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {sheetDate}
          </Text>
          {daySheet.isLoading ? (
            <ActivityIndicator color={color.primary} />
          ) : (
            (daySheet.data?.entries ?? []).map((entry) => (
              <Pressable
                key={entry.hallId}
                disabled={entry.booking === undefined}
                accessibilityRole={entry.booking !== undefined ? 'button' : undefined}
                accessibilityLabel={`${entry.hallName}: ${STATE_LABEL[entry.state]}${
                  entry.booking !== undefined ? `, ${entry.booking.customerName}` : ''
                }`}
                onPress={() => {
                  if (entry.booking !== undefined) {
                    setSheetDate(null);
                    navigation.navigate('BookingDetail', { bookingId: entry.booking.id });
                  }
                }}
                style={styles.sheetRow}
              >
                <View style={styles.sheetRowText}>
                  <Text style={styles.sheetHall}>{entry.hallName}</Text>
                  {entry.booking !== undefined ? (
                    <Text style={styles.sheetDetail}>
                      {entry.booking.customerName} · {entry.booking.bookingRef}
                    </Text>
                  ) : entry.block !== undefined ? (
                    <Text style={styles.sheetDetail}>
                      {entry.block.reason.length > 0 ? entry.block.reason : 'Blocked'}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.sheetState,
                    {
                      color:
                        entry.state === 'available'
                          ? color.success
                          : entry.state === 'booked'
                            ? color.danger
                            : color.textSecondary,
                    },
                  ]}
                >
                  {STATE_LABEL[entry.state]}
                </Text>
              </Pressable>
            ))
          )}
          <View style={styles.sheetActions}>
            <Button
              label="Add Reservation"
              onPress={() => {
                const date = sheetDate as string;
                setSheetDate(null);
                navigation.navigate('AddReservation', { venueId: activeVenue.id, date });
              }}
            />
            <View style={styles.sheetActionGap} />
            <Button
              label="Block date"
              variant="secondary"
              onPress={() => {
                const date = sheetDate as string;
                setSheetDate(null);
                navigation.navigate('BlockDate', { venueId: activeVenue.id, date });
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollBody: { padding: spacing.lg },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthChevron: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChevronText: { fontSize: fontSize.hero, color: color.primary, fontWeight: '700' },
  monthTitle: { fontSize: fontSize.title, fontWeight: '700', color: color.textPrimary },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: color.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  loader: { marginVertical: spacing.xl },
  dayCell: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    margin: 1,
  },
  dayCellToday: { backgroundColor: color.primaryWash },
  dayNumber: { fontSize: fontSize.body, color: color.textPrimary },
  dayNumberMuted: { color: color.border },
  dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendText: { fontSize: fontSize.caption, color: color.textSecondary },
  hallsTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: color.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hallChips: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyText: { fontSize: fontSize.body, color: color.textSecondary, textAlign: 'center' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: { fontSize: fontSize.title, fontWeight: '700', marginBottom: spacing.md, color: color.textPrimary },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TAP_TARGET,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: spacing.sm,
  },
  sheetRowText: { flex: 1, marginRight: spacing.md },
  sheetHall: { fontSize: fontSize.body, fontWeight: '600', color: color.textPrimary },
  sheetDetail: { fontSize: fontSize.caption, color: color.textSecondary, marginTop: 2 },
  sheetState: { fontSize: fontSize.body, fontWeight: '700' },
  sheetActions: { marginTop: spacing.lg },
  sheetActionGap: { height: spacing.sm },
});
