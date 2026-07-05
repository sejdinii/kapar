import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSession } from '../shared/auth/session';
import { color, fontSize } from '../shared/design-system/tokens';
import { OtpScreen } from '../shared/auth/screens/OtpScreen';
import { WelcomeScreen } from '../shared/auth/screens/WelcomeScreen';
import { AddReservationScreen } from '../modes/business/screens/AddReservationScreen';
import { BlockDateSheet } from '../modes/business/screens/BlockDateSheet';
import { BookingDetailScreen } from '../modes/business/screens/BookingDetailScreen';
import { OnboardingScreen } from '../modes/business/screens/OnboardingScreen';
import { BusinessTabs } from './BusinessTabs';
import type { RootStackParamList } from './types';

/**
 * Auth gate → onboarding check → Business tabs (SPEC A0 routing).
 * M1 is Business-first: a signed-in user with no venue onboards one. Couple Mode (M4)
 * will add the branch question; the navigator shape already leaves room for it.
 */

const Stack = createNativeStackNavigator<RootStackParamList>();

function Splash(): React.JSX.Element {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashBrand}>Kapar</Text>
      <ActivityIndicator color={color.primary} />
    </View>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { status, venues } = useSession();

  if (status === 'loading') {
    return <Splash />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'signedOut' ? (
        <Stack.Group>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Otp" component={OtpScreen} />
        </Stack.Group>
      ) : venues.length === 0 ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
          <Stack.Screen
            name="AddReservation"
            component={AddReservationScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="BlockDate"
            component={BlockDateSheet}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: color.primaryWash,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashBrand: { fontSize: fontSize.hero, fontWeight: '800', color: color.primary },
});
