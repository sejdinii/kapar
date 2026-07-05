import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiRequestError, NetworkError } from '../../api/client';
import { otpSend, otpVerify } from '../../api/endpoints';
import { Button, Screen } from '../../design-system/components';
import { color, fontSize, MIN_TAP_TARGET, radius, spacing } from '../../design-system/tokens';
import { useSession } from '../session';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * A0 step 2 — OTP entry (no mockup; built from SPEC A0 text + Appendix A prompt).
 * One hidden input drives six rendered cells: OS autofill works, focus never fragments.
 */

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const MS_PER_SECOND = 1000;

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

export function OtpScreen({ route, navigation }: Props): React.JSX.Element {
  const { phone } = route.params;
  const { signIn, refreshVenues } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((s) => s - 1), MS_PER_SECOND);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async (fullCode: string): Promise<void> => {
    setVerifying(true);
    setError(undefined);
    try {
      const res = await otpVerify(phone, fullCode);
      await signIn({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
      // Routing after verification (SPEC A0): venue members land in Business Mode,
      // new business users onboard first. RootNavigator re-renders on session change,
      // so no manual navigation is needed here.
      void refreshVenues().catch(() => undefined);
    } catch (err) {
      setCode('');
      if (err instanceof NetworkError) {
        setError('No connection. Try again when you are online.');
      } else if (err instanceof ApiRequestError) {
        setError(
          err.retryAfterSeconds !== undefined
            ? `${err.message} (wait ${err.retryAfterSeconds}s)`
            : err.message,
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const onChange = (raw: string): void => {
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(undefined);
    if (digits.length === OTP_LENGTH) {
      void submit(digits);
    }
  };

  const resend = async (): Promise<void> => {
    try {
      const res = await otpSend(phone);
      setCooldown(res.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
    } catch {
      setError('Could not resend the code. Please try again.');
    }
  };

  return (
    <Screen style={styles.wash}>
      <Text style={styles.heading}>Enter the code</Text>
      <Text style={styles.subheading}>We sent a 6-digit code to {phone}</Text>

      <Pressable
        accessibilityLabel="Code entry"
        onPress={() => inputRef.current?.focus()}
        style={styles.cellsRow}
      >
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[styles.cell, i === code.length && styles.cellActive]}
            accessibilityLabel={`Digit ${i + 1}${code[i] !== undefined ? ` is ${code[i]}` : ''}`}
          >
            <Text style={styles.cellText}>{code[i] ?? ''}</Text>
          </View>
        ))}
      </Pressable>
      {/* Hidden driver input — OS OTP autofill targets this. */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={OTP_LENGTH}
        style={styles.hiddenInput}
        accessibilityLabel="6-digit verification code"
      />

      {error !== undefined ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        variant="secondary"
        disabled={cooldown > 0}
        loading={verifying}
        onPress={() => void resend()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change number"
        onPress={() => navigation.goBack()}
        style={styles.changeNumber}
      >
        <Text style={styles.changeNumberText}>Change number</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wash: { backgroundColor: color.primaryWash },
  heading: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: color.textPrimary,
    marginTop: spacing.xl,
  },
  subheading: {
    fontSize: fontSize.body,
    color: color.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  cellsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  cell: {
    width: 48,
    height: 56,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: color.primary },
  cellText: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { color: color.danger, fontSize: fontSize.body, marginBottom: spacing.md },
  changeNumber: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  changeNumberText: { color: color.primary, fontSize: fontSize.body, fontWeight: '600' },
});
