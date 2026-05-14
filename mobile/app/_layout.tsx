import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../store/useAuthStore";

export default function RootLayout() {
  const { token, isLoading, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (token) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/login");
    }
  }, [token, isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth/login" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="auth/register"
          options={{ gestureEnabled: false }}
        />
      </Stack>

    </GestureHandlerRootView>
  );
}
