import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSession } from '../shared/auth/session';
import { Screen } from '../shared/design-system/components';
import { color, fontSize, MIN_TAP_TARGET, spacing } from '../shared/design-system/tokens';
import { BookingsScreen } from '../modes/business/screens/BookingsScreen';
import { CalendarScreen } from '../modes/business/screens/CalendarScreen';
import { MoreScreen } from '../modes/business/screens/MoreScreen';
import type { BusinessTabParamList, RootStackParamList } from './types';

/**
 * Business Mode tab bar (SPEC §2): Dashboard · Calendar · [+] · Bookings · More,
 * with the raised purple center button opening Add Reservation — the 15-second rule
 * starts at this thumb-reachable FAB.
 */

const Tab = createBottomTabNavigator<BusinessTabParamList>();

/** Dashboard ships in M2 — an honest placeholder, not a dead screen. */
function PlaceholderDashboard(): React.JSX.Element {
  const { activeVenue } = useSession();
  return (
    <Screen scroll={false}>
      <View style={styles.dashWrap}>
        <Text style={styles.dashHello} accessibilityRole="header">
          {activeVenue !== null ? `Good day, ${activeVenue.name}` : 'Good day'}
        </Text>
        <Text style={styles.dashNote}>
          Your day-at-a-glance dashboard (requests, kapar unpaid, upcoming weddings) arrives in M2.
          Calendar and Bookings are fully live below.
        </Text>
      </View>
    </Screen>
  );
}

/** Placeholder component for the center tab — the button never actually routes here. */
function NullScreen(): React.JSX.Element {
  return <View />;
}

function AddFab(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeVenue } = useSession();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add Reservation"
      onPress={() => {
        if (activeVenue !== null) {
          navigation.navigate('AddReservation', { venueId: activeVenue.id });
        }
      }}
      style={styles.fabWrap}
    >
      <View style={styles.fab}>
        <Text style={styles.fabPlus}>+</Text>
      </View>
    </Pressable>
  );
}

const TAB_ICON: Record<Exclude<keyof BusinessTabParamList, 'AddTab'>, string> = {
  Dashboard: '▦',
  Calendar: '▤',
  Bookings: '☰',
  More: '⋯',
};

export function BusinessTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarLabelStyle: { fontSize: fontSize.caption, fontWeight: '600' },
        tabBarStyle: { height: 64, paddingBottom: spacing.sm, paddingTop: spacing.xs },
        tabBarIcon: ({ color: tint }) =>
          route.name === 'AddTab' ? null : (
            <Text style={{ color: tint, fontSize: fontSize.title }}>
              {TAB_ICON[route.name as Exclude<keyof BusinessTabParamList, 'AddTab'>]}
            </Text>
          ),
      })}
    >
      <Tab.Screen name="Dashboard" component={PlaceholderDashboard} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen
        name="AddTab"
        component={NullScreen}
        options={{ tabBarLabel: '', tabBarButton: () => <AddFab /> }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  dashWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  dashHello: { fontSize: fontSize.hero, fontWeight: '700', color: color.textPrimary, textAlign: 'center' },
  dashNote: {
    fontSize: fontSize.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fabWrap: {
    flex: 1,
    minWidth: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.xl, // raised above the bar, per the mockups
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabPlus: { color: color.card, fontSize: fontSize.hero, fontWeight: '700', lineHeight: 34 },
});
