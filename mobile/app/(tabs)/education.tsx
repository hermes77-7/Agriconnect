import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../constants/colors";

export default function EducationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Education Screen — Coming in sprint 6
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.mist,
    justifyContent: "center",
    alignItems: "center",
  },
  text: { fontSize: 14, color: COLORS.clay, textAlign: "center", padding: 24 },
});
