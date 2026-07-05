import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BookingStatus, KaparPaidState } from '@kapar/shared-types';
import { color, fontSize, MIN_TAP_TARGET, radius, spacing } from './tokens';

/**
 * Kapar UI kit — the small set of primitives every M1 screen composes (SPEC §4).
 * Accessibility floor: 44px targets, labels on every touchable, AA contrast via tokens.
 */

// ── Screen ───────────────────────────────────────────────────────────────────────────────────

export function Screen(props: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { children, scroll = true, padded = true } = props;
  const inner = padded ? styles.screenPadded : undefined;
  return (
    <SafeAreaView style={[styles.screen, props.style]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenFill, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { variant = 'primary', disabled = false, loading = false } = props;
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={blocked ? undefined : props.onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'destructive' && styles.buttonDestructive,
        blocked && styles.buttonDisabled,
        pressed && !blocked && styles.buttonPressed,
        props.style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? color.primary : color.card} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'secondary' && styles.buttonLabelSecondary,
          ]}
        >
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

// ── TextField ────────────────────────────────────────────────────────────────────────────────

export function TextField(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  helper?: string;
  inputProps?: Partial<TextInputProps>;
}): React.JSX.Element {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        style={[styles.fieldInput, props.error !== undefined && styles.fieldInputError]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={color.textSecondary}
        keyboardType={props.keyboardType}
        autoFocus={props.autoFocus}
        {...props.inputProps}
      />
      {props.error !== undefined ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {props.error}
        </Text>
      ) : props.helper !== undefined ? (
        <Text style={styles.fieldHelper}>{props.helper}</Text>
      ) : null}
    </View>
  );
}

// ── Card / SectionTitle ──────────────────────────────────────────────────────────────────────

export function Card(props: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function SectionTitle(props: { children: string }): React.JSX.Element {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {props.children}
    </Text>
  );
}

// ── StatusPill ───────────────────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: color.border, fg: color.textPrimary, label: 'Draft' },
  PENDING_PAYMENT: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending payment' },
  PENDING_VENUE: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  CONFIRMED: { bg: '#DCFCE7', fg: '#166534', label: 'Confirmed' },
  DECLINED: { bg: '#FEE2E2', fg: '#991B1B', label: 'Declined' },
  EXPIRED: { bg: color.border, fg: color.textSecondary, label: 'Expired' },
  CANCELLED_BY_COUPLE: { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
  CANCELLED_BY_VENUE: { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
};

export function StatusPill(props: { status: BookingStatus }): React.JSX.Element {
  const s = STATUS_STYLE[props.status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Status: ${s.label}`}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/** Kapar sub-status line colored by paid state (SPEC B5). */
export function kaparPaidCopy(state: KaparPaidState): { label: string; tint: string } {
  switch (state) {
    case 'yes':
      return { label: 'Kapar paid', tint: color.success };
    case 'partially':
      return { label: 'Kapar partially paid', tint: color.pending };
    case 'no':
      return { label: 'Kapar unpaid', tint: color.pending };
  }
}

// ── Chip ─────────────────────────────────────────────────────────────────────────────────────

export function Chip(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[styles.chip, props.selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, props.selected && styles.chipTextSelected]}>{props.label}</Text>
    </Pressable>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  screenFill: { flex: 1 },
  screenPadded: { padding: spacing.lg },

  button: {
    minHeight: MIN_TAP_TARGET + 4,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: color.primary },
  buttonSecondary: {
    backgroundColor: color.card,
    borderWidth: 1.5,
    borderColor: color.primary,
  },
  buttonDestructive: { backgroundColor: color.danger },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { color: color.card, fontSize: fontSize.title, fontWeight: '700' },
  buttonLabelSecondary: { color: color.primary },

  fieldWrap: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: color.textPrimary,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    minHeight: MIN_TAP_TARGET + 4,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.card,
    backgroundColor: color.card,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.title,
    color: color.textPrimary,
  },
  fieldInputError: { borderColor: color.danger },
  fieldError: { color: color.danger, fontSize: fontSize.caption, marginTop: spacing.xs },
  fieldHelper: { color: color.textSecondary, fontSize: fontSize.caption, marginTop: spacing.xs },

  card: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    // Soft shadow separating white cards from the near-white canvas (SPEC §4).
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: color.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: fontSize.caption, fontWeight: '700' },

  chip: {
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.card,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: { borderColor: color.primary, backgroundColor: color.primaryWash },
  chipText: { fontSize: fontSize.body, color: color.textPrimary },
  chipTextSelected: { color: color.primary, fontWeight: '700' },
});
