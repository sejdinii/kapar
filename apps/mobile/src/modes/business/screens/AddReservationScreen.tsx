import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BookingSource, CreateBookingRequest, EventType, KaparPaidState } from '@kapar/shared-types';
import { ApiRequestError } from '../../../shared/api/client';
import { useSession } from '../../../shared/auth/session';
import { Button, Card, Chip, Screen, SectionTitle, TextField } from '../../../shared/design-system/components';
import { color, fontSize, spacing } from '../../../shared/design-system/tokens';
import { useCreateBooking } from '../hooks/useBookings';
import { todayISO } from '../hooks/useCalendar';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * B3 — Add Reservation. THE 15-SECOND RULE (Law #2): faster than the paper notebook,
 * one-handed. Required: name + phone. Everything else is prefilled or optional.
 * Source chips power B8 analytics. Offline saves queue with a visible pending state.
 */

const SOURCES: Array<{ key: BookingSource; label: string }> = [
  { key: 'phone', label: 'Phone' },
  { key: 'viber', label: 'Viber' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'walkin', label: 'Walk-in' },
  { key: 'other', label: 'Other' },
];

const EVENT_TYPES: Array<{ key: EventType; label: string }> = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'sunet', label: 'Sunet Celebration' },
  { key: 'other', label: 'Other' },
];

const PAID_STATES: Array<{ key: KaparPaidState; label: string }> = [
  { key: 'yes', label: 'Yes' },
  { key: 'partially', label: 'Partially' },
  { key: 'no', label: 'No' },
];

const DEFAULT_START = '17:00';
const DEFAULT_END = '01:00';
/** Unit conversion only — EUR to cents. NOT price computation (Law #3: the server owns money math). */
const CENTS_PER_EUR = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function newClientRequestId(): string {
  // reason: RN 0.76 Hermes provides crypto.randomUUID; the fallback keeps the queue usable
  // on engines without it (uniqueness here guards idempotent replay, not security).
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID !== undefined) {
    return g.crypto.randomUUID();
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  return `${hex(Date.now() % 0xffffffff)}-q-${hex(Math.floor(Math.random() * 0xffffffff))}`;
}

type Props = NativeStackScreenProps<RootStackParamList, 'AddReservation'>;

export function AddReservationScreen({ route, navigation }: Props): React.JSX.Element {
  const { activeVenue } = useSession();
  const create = useCreateBooking(route.params.venueId);

  const [source, setSource] = useState<BookingSource>('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(route.params.date ?? todayISO());
  const [hallId, setHallId] = useState(route.params.hallId ?? activeVenue?.halls[0]?.id ?? '');
  const [moreOpen, setMoreOpen] = useState(false);
  const [guests, setGuests] = useState('');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [notes, setNotes] = useState('');
  const [kaparEur, setKaparEur] = useState('');
  const [paidState, setPaidState] = useState<KaparPaidState>('no');
  const [receivedEur, setReceivedEur] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [conflictLabel, setConflictLabel] = useState<string | null>(null);
  const [done, setDone] = useState<'saved' | 'queued' | null>(null);

  // clientRequestId is stable for this form instance: retrying after a network blip
  // can never double-book (server-side idempotency).
  const clientRequestId = useMemo(newClientRequestId, []);

  const save = async (): Promise<void> => {
    setError(undefined);
    setConflictLabel(null);
    if (name.trim().length === 0 || phone.trim().length === 0) {
      setError('Couple name and phone are required — everything else can wait.');
      return;
    }
    if (!DATE_PATTERN.test(date)) {
      setError('Date must be YYYY-MM-DD.');
      return;
    }
    if (hallId.length === 0) {
      setError('Pick a hall.');
      return;
    }
    const kaparMinor = kaparEur.trim().length > 0 ? Number(kaparEur) * CENTS_PER_EUR : undefined;
    const receivedMinor =
      receivedEur.trim().length > 0 ? Number(receivedEur) * CENTS_PER_EUR : undefined;
    if (kaparMinor !== undefined && !Number.isInteger(kaparMinor)) {
      setError('Kapar amount must be whole euro cents.');
      return;
    }

    const req: CreateBookingRequest = {
      hallId,
      eventDate: date,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      source,
      clientRequestId,
      ...(guests.trim().length > 0 ? { guests: Number(guests) } : {}),
      eventType,
      startTime,
      endTime,
      ...(kaparMinor !== undefined ? { kaparAmount: { minor: kaparMinor, currency: 'EUR' } } : {}),
      ...(receivedMinor !== undefined
        ? { kaparReceived: { minor: receivedMinor, currency: 'EUR' } }
        : {}),
      kaparPaidState: paidState,
      ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
    };

    try {
      const result = await create.mutateAsync(req);
      setDone(result.queued ? 'queued' : 'saved');
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'SLOT_TAKEN') {
        setConflictLabel(err.holder?.label ?? 'another reservation');
      } else if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  if (done !== null) {
    return (
      <Screen scroll={false}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>{done === 'saved' ? 'Reservation saved' : 'Saved — will sync'}</Text>
          <Text style={styles.doneBody}>
            {done === 'saved'
              ? 'The calendar is updated.'
              : 'No connection right now. This reservation is queued on your phone and will sync automatically.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Add Reservation
      </Text>

      {/* Source chips FIRST — one tap, powers B8 source analytics */}
      <View style={styles.chipRow}>
        {SOURCES.map((s) => (
          <Chip key={s.key} label={s.label} selected={source === s.key} onPress={() => setSource(s.key)} />
        ))}
      </View>

      <TextField label="Couple / customer name" value={name} onChangeText={setName} autoFocus placeholder="Elena & Stefan" />
      <TextField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+389 70 123 456"
        helper="Foreign numbers welcome — diaspora weddings happen."
      />
      <TextField label="Event date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />

      <Text style={styles.fieldLabel}>Hall</Text>
      <View style={styles.chipRow}>
        {(activeVenue?.halls ?? []).map((h) => (
          <Chip key={h.id} label={h.name} selected={hallId === h.id} onPress={() => setHallId(h.id)} />
        ))}
      </View>

      {/* Kapar — integers only; the server owns all money logic (Law #3) */}
      <SectionTitle>Kapar (deposit)</SectionTitle>
      <TextField label="Kapar amount (EUR)" value={kaparEur} onChangeText={(t) => setKaparEur(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="500" />
      <Text style={styles.fieldLabel}>Kapar paid?</Text>
      <View style={styles.chipRow}>
        {PAID_STATES.map((p) => (
          <Chip key={p.key} label={p.label} selected={paidState === p.key} onPress={() => setPaidState(p.key)} />
        ))}
      </View>
      {paidState === 'partially' ? (
        <TextField label="Amount received (EUR)" value={receivedEur} onChangeText={(t) => setReceivedEur(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="200" />
      ) : null}

      {/* Optional details stay collapsed — the 15-second path never scrolls past them */}
      <Button
        label={moreOpen ? 'Hide details' : 'More details (guests, times, notes)'}
        variant="secondary"
        onPress={() => setMoreOpen((v) => !v)}
      />
      {moreOpen ? (
        <View style={styles.moreBlock}>
          <TextField label="Guests" value={guests} onChangeText={(t) => setGuests(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="300" />
          <Text style={styles.fieldLabel}>Event type</Text>
          <View style={styles.chipRow}>
            {EVENT_TYPES.map((e) => (
              <Chip key={e.key} label={e.label} selected={eventType === e.key} onPress={() => setEventType(e.key)} />
            ))}
          </View>
          <TextField label="Start" value={startTime} onChangeText={setStartTime} placeholder="17:00" />
          <TextField label="End" value={endTime} onChangeText={setEndTime} placeholder="01:00" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" />
        </View>
      ) : null}

      {conflictLabel !== null ? (
        <Card style={styles.conflictCard}>
          <Text style={styles.conflictTitle}>This date was just booked</Text>
          <Text style={styles.conflictBody}>{conflictLabel}</Text>
          <Text style={styles.conflictBody}>Pick another date or hall and save again.</Text>
        </Card>
      ) : null}
      {error !== undefined ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button label="Save Reservation" onPress={() => void save()} loading={create.isPending} style={styles.saveButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary, marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.body, fontWeight: '600', color: color.textPrimary, marginBottom: spacing.xs },
  moreBlock: { marginTop: spacing.lg },
  conflictCard: { marginTop: spacing.lg, borderWidth: 1, borderColor: color.danger },
  conflictTitle: { fontSize: fontSize.title, fontWeight: '700', color: color.danger },
  conflictBody: { fontSize: fontSize.body, color: color.textPrimary, marginTop: spacing.xs },
  error: { color: color.danger, fontSize: fontSize.body, marginTop: spacing.md },
  saveButton: { marginTop: spacing.lg, marginBottom: spacing.xl },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: fontSize.hero, fontWeight: '700', color: color.success },
  doneBody: { fontSize: fontSize.body, color: color.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
