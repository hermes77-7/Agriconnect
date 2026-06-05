import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useAuthStore } from "../../store/useAuthStore";
import { userService } from "../../services/api/userService";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, sublabel, onPress, danger }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuInfo}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {label}
        </Text>
        {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
      </View>
      {danger ? (
        <Ionicons name="log-out-outline" size={20} color="#C62828" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.clay} />
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const roleLabel = () => {
    switch (user?.type) {
      case "FARMER":
        return "Farmer";
      case "WHOLESALER":
        return "Wholesaler";
      case "TRANSPORTER":
        return "Transporter";
      default:
        return "User";
    }
  };

  const roleColor = () => {
    switch (user?.type) {
      case "FARMER":
        return COLORS.moss;
      case "WHOLESALER":
        return COLORS.harvest;
      case "TRANSPORTER":
        return COLORS.bark;
      default:
        return COLORS.clay;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={COLORS.clay} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleColor() }]}>
              <Text style={styles.roleBadgeText}>{roleLabel()}</Text>
            </View>
          </View>
        </View>

        {/* Account section */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <MenuItem
            icon={
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.harvest}
              />
            }
            label="Edit Profile"
            sublabel="Update your name, phone and password"
            onPress={() => router.push("/profile/edit")}
          />
          <MenuItem
            icon={
              <Ionicons
                name="receipt-outline"
                size={20}
                color={COLORS.harvest}
              />
            }
            label="Order History"
            sublabel="View all your past orders"
            onPress={() => router.push("/profile/order-history")}
          />
        </View>

        {/* Farmer only */}
        {user?.type === "FARMER" && (
          <>
            <SectionHeader title="Farmer Tools" />
            <View style={styles.section}>
              <MenuItem
                icon={
                  <MaterialCommunityIcons
                    name="sprout-outline"
                    size={20}
                    color={COLORS.moss}
                  />
                }
                label="My Listings"
                sublabel="Manage your produce listings"
                onPress={() => router.push("/profile/my-listings")}
              />
            </View>
          </>
        )}

        {/* Wholesaler only */}
        {user?.type === "WHOLESALER" && (
          <>
            <SectionHeader title="Expand Your Role" />
            <View style={styles.section}>
              <MenuItem
                icon={
                  <MaterialCommunityIcons
                    name="sprout-outline"
                    size={20}
                    color={COLORS.moss}
                  />
                }
                label="Become a Farmer"
                sublabel="Start listing your own produce"
                onPress={() => {
                  Alert.alert(
                    "Become a Farmer",
                    "This will change your account role to Farmer. You will be logged out and need to sign in again. Continue?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm",
                        onPress: async () => {
                          try {
                            await userService.upgradeRole("FARMER");
                            await logout();
                            router.replace("/auth/login");
                          } catch (err: any) {
                            Alert.alert(
                              "Error",
                              err.response?.data?.error ||
                                "Could not upgrade role",
                            );
                          }
                        },
                      },
                    ],
                  );
                }}
              />
              <MenuItem
                icon={
                  <MaterialCommunityIcons
                    name="truck-delivery-outline"
                    size={20}
                    color={COLORS.clay}
                  />
                }
                label="Become a Transporter"
                sublabel="Offer delivery services"
                onPress={() => {
                  Alert.alert(
                    "Become a Transporter",
                    "This will change your account role to Transporter. You will be logged out and need to sign in again. Continue?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm",
                        onPress: async () => {
                          try {
                            await userService.upgradeRole("TRANSPORTER");
                            await logout();
                            router.replace("/auth/login");
                          } catch (err: any) {
                            Alert.alert(
                              "Error",
                              err.response?.data?.error ||
                                "Could not upgrade role",
                            );
                          }
                        },
                      },
                    ],
                  );
                }}
              />
            </View>
          </>
        )}

        {/* Transporter only */}
        {user?.type === "TRANSPORTER" && (
          <>
            <SectionHeader title="Transport Tools" />
            <View style={styles.section}>
              <MenuItem
                icon={
                  <MaterialCommunityIcons
                    name="truck-check-outline"
                    size={20}
                    color={COLORS.clay}
                  />
                }
                label="Delivery History"
                sublabel="View your completed deliveries"
                onPress={() => router.push("/profile/delivery-history")}
              />
            </View>
          </>
        )}

        {/* Logout */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <MenuItem
            icon={<Ionicons name="log-out-outline" size={20} color="#C62828" />}
            label="Logout"
            onPress={handleLogout}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.mist,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.soil },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    margin: 16,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 40,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 18, fontWeight: "700", color: COLORS.soil },
  userEmail: { fontSize: 13, color: COLORS.clay },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.white },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ghost,
  },  
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconDanger: { backgroundColor: "#FFEBEE" },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "600", color: COLORS.soil },
  menuLabelDanger: { color: "#C62828" },
  menuSublabel: { fontSize: 12, color: COLORS.clay, marginTop: 2 },
});
