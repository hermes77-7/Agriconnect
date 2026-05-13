import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useEffect } from "react";
import { COLORS } from "../../constants/colors";
import { useAuthStore } from "../../store/useAuthStore";
import { useOrderStore } from "../../store/useOrderStore";

function RedDot() {
  return <View style={styles.redDot} />;
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const { pendingCount, fetchPendingCount } = useOrderStore();
  const isFarmer = user?.type === "FARMER";

  useEffect(() => {
    if (isFarmer) {
      fetchPendingCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isFarmer]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.cream,
          borderTopColor: COLORS.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.harvest,
        tabBarInactiveTintColor: COLORS.clay,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Market",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="farmer"
        options={{
          title: "Farmer",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="sprout-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="receipt-outline" size={size} color={color} />
              {isFarmer && pendingCount > 0 && <RedDot />}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="transporter"
        options={{
          title: "Transport",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="analysis"
        options={{
          title: "Analysis",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  redDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.harvest,
  },
});
