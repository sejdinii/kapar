import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../../shared/auth/session';
import { Button, Card, Screen } from '../../../shared/design-system/components';
import { color, fontSize, spacing } from '../../../shared/design-system/tokens';

/**
 * More tab — venue identity + the honest roadmap (visible plans, not dead buttons)
 * + Log out with the SPEC C13 confirmation copy.
 */

const ROADMAP: Array<{ label: string; milestone: string }> = [
  { label: 'Dashboard KPIs', milestone: 'M2' },
  { label: 'Price rules & menu tiers', milestone: 'M2' },
  { label: 'Customers', milestone: 'M2' },
  { label: 'Staff & roles', milestone: 'M2' },
  { label: 'Analytics', milestone: 'M2' },
  { label: 'Payments & payouts', milestone: 'M3' },
];

export function MoreScreen(): React.JSX.Element {
  const { user, activeVenue, signOut } = useSession();

  const confirmLogout = (): void => {
    Alert.alert('Log out?', "You'll need to verify your phone number to sign back in.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        More
      </Text>

      {activeVenue !== null ? (
        <Card style={styles.venueCard}>
          <Text style={styles.venueName}>{activeVenue.name}</Text>
          <Text style={styles.venueCity}>{activeVenue.city}</Text>
          {activeVenue.status === 'draft' ? (
            <Text style={styles.draftChip}>Draft — only you can see this venue until it is approved</Text>
          ) : null}
          <Text style={styles.roleLine}>
            Signed in as {user?.name ?? user?.phone ?? ''} · {activeVenue.myRole}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.roadmapCard}>
        <Text style={styles.roadmapTitle}>Coming next</Text>
        {ROADMAP.map((item) => (
          <View key={item.label} style={styles.roadmapRow}>
            <Text style={styles.roadmapLabel}>{item.label}</Text>
            <Text style={styles.roadmapMilestone}>{item.milestone}</Text>
          </View>
        ))}
      </Card>

      <Button label="Log out" variant="destructive" onPress={confirmLogout} style={styles.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary, marginBottom: spacing.lg },
  venueCard: { marginBottom: spacing.lg },
  venueName: { fontSize: fontSize.title, fontWeight: '700', color: color.textPrimary },
  venueCity: { fontSize: fontSize.body, color: color.textSecondary, marginTop: 2 },
  draftChip: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: color.pending,
    fontWeight: '600',
  },
  roleLine: { marginTop: spacing.sm, fontSize: fontSize.caption, color: color.textSecondary },
  roadmapCard: { marginBottom: spacing.xl },
  roadmapTitle: { fontSize: fontSize.body, fontWeight: '700', color: color.textPrimary, marginBottom: spacing.sm },
  roadmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  roadmapLabel: { fontSize: fontSize.body, color: color.textSecondary },
  roadmapMilestone: { fontSize: fontSize.caption, fontWeight: '700', color: color.primary },
  logout: { marginBottom: spacing.xl },
});
