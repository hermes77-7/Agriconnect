import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useAuthStore } from "../../store/useAuthStore";
import { userService } from "../../services/api/userService";

export default function EditProfileScreen() {
  const { user, setAuth } = useAuthStore();
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showPwSection, setShowPwSection] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const updated = await userService.updateProfile({
        name: name.trim(),
        phone,
      });
      // Update auth store with new name
      if (user && token) {
        await setAuth(token, { ...user, name: updated.name });
      }
      Alert.alert("Success", "Profile updated successfully");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert("Error", "All password fields are required");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    if (newPw.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    setChangingPw(true);
    try {
      await userService.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwSection(false);
      Alert.alert("Success", "Password changed successfully");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not change password",
      );
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={44} color={COLORS.clay} />
            </View>
            <Text style={styles.avatarEmail}>{user?.email}</Text>
            <Text style={styles.avatarHint}>Email cannot be changed</Text>
          </View>

          {/* Profile fields */}
          <Text style={styles.sectionLabel}>Personal Info</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={COLORS.clay}
              />
            </View>
            <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 699 000 000"
                placeholderTextColor={COLORS.clay}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {/* Password section toggle */}
          <TouchableOpacity
            style={styles.pwToggle}
            onPress={() => setShowPwSection(!showPwSection)}
          >
            <Text style={styles.sectionLabel}>Change Password</Text>
            <Ionicons
              name={showPwSection ? "chevron-up" : "chevron-down"}
              size={18}
              color={COLORS.clay}
            />
          </TouchableOpacity>

          {showPwSection && (
            <View style={styles.fieldGroup}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.clay}
                  secureTextEntry
                />
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPw}
                  onChangeText={setNewPw}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={COLORS.clay}
                  secureTextEntry
                />
              </View>
              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.fieldLabel}>Confirm New</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  placeholder="Repeat new password"
                  placeholderTextColor={COLORS.clay}
                  secureTextEntry
                />
              </View>
            </View>
          )}

          {showPwSection && (
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: COLORS.bark },
                changingPw && { opacity: 0.6 },
              ]}
              onPress={handleChangePassword}
              disabled={changingPw}
            >
              {changingPw ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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

  scroll: { padding: 20 },

  avatarWrap: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  avatarEmail: { fontSize: 14, fontWeight: "600", color: COLORS.soil },
  avatarHint: { fontSize: 11, color: COLORS.clay, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  fieldGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ghost,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.soil,
    width: 110,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.soil,
  },

  saveBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },

  pwToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
});
