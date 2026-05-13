import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useAuthStore, UserType } from "../../store/useAuthStore";
import { authService } from "../../services/api/authService";
import { COLORS } from "../../constants/colors";

const USER_TYPES: { label: string; value: UserType }[] = [
  { label: "Farmer", value: "FARMER" },
  { label: "Wholesaler", value: "WHOLESALER" },
  { label: "Transporter", value: "TRANSPORTER" },
];

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("FARMER");
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Name, email and password are required");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await authService.register({
        name,
        email,
        phone,
        password,
        type: userType,
      });
      await setAuth(token, user);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg =
        err.response?.data?.error || "Registration failed. Please try again.";
      Alert.alert("Registration Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>JOIN AGRICONNECT</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Connect with farmers, wholesalers and transporters
          </Text>
        </View>

        <View style={styles.form}>
          {/* Role Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.roleRow}>
              {USER_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.roleBtn,
                    userType === t.value && styles.roleBtnActive,
                  ]}
                  onPress={() => setUserType(t.value)}
                >
                  <Text
                    style={[
                      styles.roleBtnText,
                      userType === t.value && styles.roleBtnTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Jean Fotso"
              placeholderTextColor={COLORS.clay}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.clay}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="699 000 000"
              placeholderTextColor={COLORS.clay}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              placeholderTextColor={COLORS.clay}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat your password"
              placeholderTextColor={COLORS.clay}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.link} onPress={() => router.back()}>
            <Text style={styles.linkText}>
              Already have an account?{" "}
              <Text style={styles.linkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.mist,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.clay,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.soil,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
  },
  roleBtnActive: {
    backgroundColor: COLORS.soil,
    borderColor: COLORS.soil,
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.clay,
  },
  roleBtnTextActive: {
    color: COLORS.sun,
  },
  button: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  link: {
    alignItems: "center",
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.clay,
  },
  linkBold: {
    color: COLORS.harvest,
    fontWeight: "700",
  },
});
