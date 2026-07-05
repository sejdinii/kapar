import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { color, fontSize, spacing } from '@/shared/design-system/tokens';

/**
 * Root component — scaffold placeholder.
 *
 * The real app wires A0 (shared entry) → mode router → Couple/Business tab navigators, with the
 * Business bundle lazy-loaded (SPEC §2). No navigation/feature code ships until M1. This screen
 * just proves the toolchain, TS strict, the shared-types workspace, and the design tokens resolve.
 */
export function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Kapar</Text>
      <Text style={styles.tag}>Find the perfect venue. Book with confidence.</Text>
      <Text style={styles.note}>Scaffold ready — M1 (Business core) is next.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: {
    fontSize: fontSize.hero,
    fontWeight: '800',
    color: color.primary,
  },
  tag: {
    marginTop: spacing.sm,
    fontSize: fontSize.title,
    color: color.textPrimary,
    textAlign: 'center',
  },
  note: {
    marginTop: spacing.xl,
    fontSize: fontSize.caption,
    color: color.textSecondary,
  },
});
