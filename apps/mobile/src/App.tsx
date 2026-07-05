import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/RootNavigator';
import { SessionProvider } from './shared/auth/session';

/**
 * Kapar app root — providers only; screens live under navigation/ and modes/.
 * M1 ships Business Mode (CLAUDE.md §9); Couple Mode mounts in M4 behind the same shell.
 */

const STALE_TIME_MS = 30_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: STALE_TIME_MS },
  },
});

export function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
