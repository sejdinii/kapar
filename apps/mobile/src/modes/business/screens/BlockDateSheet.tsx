import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiRequestError } from '../../../shared/api/client';
import { createBlock } from '../../../shared/api/endpoints';
import { useSession } from '../../../shared/auth/session';
import { Button, Card, Chip, Screen, TextField } from '../../../shared/design-system/components';
import { color, fontSize, spacing } from '../../../shared/design-system/tokens';
import { todayISO } from '../hooks/useCalendar';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * B7 — Block Date: take inventory off the market instantly. Range toggle covers
 * renovations (blocking 30 days one-by-one fails the 15-second spirit). A slot that
 * holds a booking refuses with the conflict card — cancel the booking first, explicitly.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Props = NativeStackScreenProps<RootStackParamList, 'BlockDate'>;

export function BlockDateSheet({ route, navigation }: Props): React.JSX.Element {
  const { activeVenue } = useSession();
  const queryClient = useQueryClient();
  const halls = activeVenue?.halls ?? [];

  const [hallIds, setHallIds] = useState<string[]>(
    route.params.hallId !== undefined ? [route.params.hallId] : halls.map((h) => h.id),
  );
  const [dateFrom, setDateFrom] = useState(route.params.date ?? todayISO());
  const [range, setRange] = useState(false);
  const [dateTo, setDateTo] = useState(route.params.date ?? todayISO());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleHall = (id: string): void => {
    setHallIds((cur) => (cur.includes(id) ? cur.filter((h) => h !== id) : [...cur, id]));
  };

  const submit = async (): Promise<void> => {
    setError(undefined);
    setConflict(null);
    if (!DATE_PATTERN.test(dateFrom) || (range && !DATE_PATTERN.test(dateTo))) {
      setError('Dates must be YYYY-MM-DD.');
      return;
    }
    if (hallIds.length === 0) {
      setError('Pick at least one hall.');
      return;
    }
    const to = range ? dateTo : dateFrom;
    if (to < dateFrom) {
      setError('End date is before start date.');
      return;
    }
    setSaving(true);
    try {
      // One call per hall; abort on the first conflict and NAME the conflicting hall —
      // a silent partial block would misstate what is off the market (SPEC B7).
      for (const hallId of hallIds) {
        try {
          await createBlock(route.params.venueId, {
            hallId,
            dateFrom,
            dateTo: to,
            ...(reason.trim().length > 0 ? { reason: reason.trim() } : {}),
          });
        } catch (err) {
          if (err instanceof ApiRequestError && err.code === 'SLOT_TAKEN') {
            const hallName = halls.find((h) => h.id === hallId)?.name ?? 'a hall';
            setConflict(`${hallName}: ${err.holder?.label ?? err.message} — cancel that booking first.`);
            return;
          }
          throw err;
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['daySheet'] });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Block Date
      </Text>

      <Text style={styles.fieldLabel}>Halls</Text>
      <View style={styles.chipRow}>
        {halls.map((h) => (
          <Chip key={h.id} label={h.name} selected={hallIds.includes(h.id)} onPress={() => toggleHall(h.id)} />
        ))}
      </View>

      <TextField label="Date" value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />

      <View style={styles.rangeRow}>
        <Text style={styles.fieldLabel}>Block a range (renovation, holidays)</Text>
        <Switch
          value={range}
          onValueChange={setRange}
          accessibilityLabel="Block a date range"
          trackColor={{ true: color.primaryAccent, false: color.border }}
        />
      </View>
      {range ? (
        <TextField label="Until (inclusive)" value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      ) : null}

      <TextField label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Renovation, private event…" />

      {conflict !== null ? (
        <Card style={styles.conflictCard}>
          <Text style={styles.conflictTitle}>Can&apos;t block — the date is taken</Text>
          <Text style={styles.conflictBody}>{conflict}</Text>
        </Card>
      ) : null}
      {error !== undefined ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button label="Block" onPress={() => void submit()} loading={saving} style={styles.blockButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary, marginBottom: spacing.lg },
  fieldLabel: { fontSize: fontSize.body, fontWeight: '600', color: color.textPrimary, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  conflictCard: { marginTop: spacing.md, borderWidth: 1, borderColor: color.danger },
  conflictTitle: { fontSize: fontSize.title, fontWeight: '700', color: color.danger },
  conflictBody: { fontSize: fontSize.body, color: color.textPrimary, marginTop: spacing.xs },
  error: { color: color.danger, fontSize: fontSize.body, marginTop: spacing.md },
  blockButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
