import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../../../shared/api/client';
import { createVenue } from '../../../shared/api/endpoints';
import { useSession } from '../../../shared/auth/session';
import { Button, Card, Screen, SectionTitle, TextField } from '../../../shared/design-system/components';
import { color, fontSize, MIN_TAP_TARGET, spacing } from '../../../shared/design-system/tokens';

/**
 * Business onboarding, M1 scope (SPEC §2): venue name, city, halls. Photos, price
 * rules, and payout IBAN come in M2 — said honestly on screen, not implied.
 * // KAPAR-BLOCKER: admin verification queue is M5; venues stay 'draft' (owner-only
 * // visibility) until approval exists. The status chip on MoreScreen says so.
 */

interface HallDraft {
  name: string;
  capacity: string;
}

const MAX_HALLS = 20;

export function OnboardingScreen(): React.JSX.Element {
  const { refreshVenues } = useSession();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [halls, setHalls] = useState<HallDraft[]>([{ name: '', capacity: '' }]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const updateHall = (index: number, patch: Partial<HallDraft>): void => {
    setHalls((cur) => cur.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const submit = async (): Promise<void> => {
    setError(undefined);
    const cleanHalls = halls
      .filter((h) => h.name.trim().length > 0)
      .map((h) => ({ name: h.name.trim(), capacityMax: Number(h.capacity) || 0 }));
    if (name.trim().length === 0 || city.trim().length === 0) {
      setError('Venue name and city are required.');
      return;
    }
    if (cleanHalls.length === 0 || cleanHalls.some((h) => h.capacityMax <= 0)) {
      setError('Add at least one hall with its capacity.');
      return;
    }
    setSaving(true);
    try {
      await createVenue({ name: name.trim(), city: city.trim(), halls: cleanHalls });
      await refreshVenues(); // RootNavigator flips to BusinessTabs when a venue exists
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Your venue
      </Text>
      <Text style={styles.subtitle}>
        The basics first — you can add photos and prices in Settings later (coming in M2).
      </Text>

      <TextField label="Venue name" value={name} onChangeText={setName} placeholder="Villa Elegance" autoFocus />
      <TextField label="City" value={city} onChangeText={setCity} placeholder="Skopje" />

      <SectionTitle>Halls</SectionTitle>
      {halls.map((hall, i) => (
        <Card key={i} style={styles.hallCard}>
          <TextField label={`Hall ${i + 1} name`} value={hall.name} onChangeText={(t) => updateHall(i, { name: t })} placeholder="Grand Hall" />
          <TextField
            label="Max guests"
            value={hall.capacity}
            onChangeText={(t) => updateHall(i, { capacity: t.replace(/\D/g, '') })}
            keyboardType="number-pad"
            placeholder="400"
          />
          {halls.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove hall ${i + 1}`}
              onPress={() => setHalls((cur) => cur.filter((_, j) => j !== i))}
              style={styles.removeHall}
            >
              <Text style={styles.removeHallText}>Remove</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
      {halls.length < MAX_HALLS ? (
        <Button label="Add another hall" variant="secondary" onPress={() => setHalls((cur) => [...cur, { name: '', capacity: '' }])} />
      ) : null}

      {error !== undefined ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button label="Create venue" onPress={() => void submit()} loading={saving} style={styles.createButton} />
      <View style={styles.footerSpace} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary },
  subtitle: {
    fontSize: fontSize.body,
    color: color.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  hallCard: { marginBottom: spacing.md },
  removeHall: { minHeight: MIN_TAP_TARGET, justifyContent: 'center' },
  removeHallText: { color: color.danger, fontWeight: '600', fontSize: fontSize.body },
  error: { color: color.danger, fontSize: fontSize.body, marginTop: spacing.md },
  createButton: { marginTop: spacing.lg },
  footerSpace: { height: spacing.xl },
});
