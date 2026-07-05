import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { otpSend } from '../../api/endpoints';
import { ApiRequestError, NetworkError } from '../../api/client';
import { Button, Card, Chip, Screen, TextField } from '../../design-system/components';
import { color, fontSize, spacing } from '../../design-system/tokens';
import type { RootStackParamList } from '../../../navigation/types';

/**
 * A0 — Welcome & phone verification (SPEC A0). Mode-neutral entry: couples AND owners.
 * Honest-copy rules applied: no fabricated social proof; the trust line is truthful.
 */

/** Country codes users actually carry here: NM, Kosovo, Albania, Serbia, Montenegro, Greece. */
const COUNTRY_CODES = ['+389', '+383', '+355', '+381', '+382', '+30'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  const [countryCode, setCountryCode] = useState<string>(COUNTRY_CODES[0]);
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const submit = async (): Promise<void> => {
    setError(undefined);
    const phone = `${countryCode}${national.replace(/^0+/, '')}`;
    if (national.trim().length < 6) {
      setError('Enter your phone number.');
      return;
    }
    setSending(true);
    try {
      const res = await otpSend(phone);
      if (res.retryAfterSeconds !== undefined) {
        setError(
          `Too many codes requested. Try again in ${Math.ceil(res.retryAfterSeconds / 60)} min.`,
        );
        return;
      }
      navigation.navigate('Otp', { phone });
    } catch (err) {
      if (err instanceof NetworkError) {
        setError('No connection. Your number is kept — try again when you are online.');
      } else if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen style={styles.wash}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>Kapar</Text>
        <Text style={styles.tagline}>Find the perfect venue. Book with confidence.</Text>
      </View>

      <Text style={styles.heading}>Welcome</Text>
      <Text style={styles.subheading}>Let&apos;s get started with your phone number</Text>

      <View style={styles.codeRow}>
        {COUNTRY_CODES.map((code) => (
          <Chip
            key={code}
            label={code}
            selected={code === countryCode}
            onPress={() => setCountryCode(code)}
          />
        ))}
      </View>
      <TextField
        label="Phone number"
        value={national}
        onChangeText={(t) => setNational(t.replace(/[^\d\s-]/g, ''))}
        placeholder="70 123 456"
        keyboardType="phone-pad"
        error={error}
        inputProps={{ textContentType: 'telephoneNumber', autoComplete: 'tel' }}
      />
      <Button label="Continue" onPress={() => void submit()} loading={sending} />

      <Card style={styles.explainer}>
        <Text style={styles.explainerTitle}>We&apos;ll send you a 6-digit code</Text>
        <Text style={styles.explainerBody}>
          One text message verifies your number. No password to remember.
        </Text>
      </Card>

      {/* SPEC A0 copy correction: truthful trust line until real numbers exist. */}
      <Text style={styles.trustLine}>Built for venues and couples in North Macedonia</Text>
      <Text style={styles.legal}>
        By continuing, you agree to our Terms &amp; Conditions and Privacy Policy.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wash: { backgroundColor: color.primaryWash },
  brandBlock: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  brand: { fontSize: fontSize.hero, fontWeight: '800', color: color.primary },
  tagline: {
    marginTop: spacing.xs,
    fontSize: fontSize.body,
    color: color.textSecondary,
    textAlign: 'center',
  },
  heading: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary },
  subheading: {
    fontSize: fontSize.body,
    color: color.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  codeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  explainer: { marginTop: spacing.xl },
  explainerTitle: { fontSize: fontSize.body, fontWeight: '700', color: color.textPrimary },
  explainerBody: { fontSize: fontSize.body, color: color.textSecondary, marginTop: spacing.xs },
  trustLine: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
  legal: {
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontSize: fontSize.caption,
    color: color.textSecondary,
  },
});
