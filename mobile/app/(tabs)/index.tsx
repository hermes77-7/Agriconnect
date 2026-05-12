
import { View, Text, StyleSheet, FlatList } from "react-native";

import { COLORS } from "../../constants/colors";
import { MOCK_PRODUCE } from "../../constants/mockData";
import ProduceCard from "../../components/cards/ProduceCard";
import { Ionicons } from "@expo/vector-icons";

export default function MarketplaceScreen() {
  return (
    <View style={styles.container}>
      {/* HEADER AREA */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>AGRICONNECT MARKET</Text>

            <Text style={styles.title}>Fresh Produce</Text>
          </View>

          <View style={styles.profileButton}>
            <Ionicons name="person-outline" size={22} color={COLORS.soil} />
          </View>
        </View>
      </View>

      <View style={styles.innercontainer}>
        {/* LIST */}
        <FlatList
          data={MOCK_PRODUCE}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{
            paddingBottom: 120,
            paddingTop: 10,
            gap: 0
          }}
          renderItem={({ item }) => <ProduceCard item={item} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.mist,
  },

  innercontainer: {
    flex: 1,
    backgroundColor: COLORS.mist,
    paddingHorizontal: 12,
  },

  /* NEW HEADER BACKGROUND WRAPPER */
  headerContainer: {
    backgroundColor: "#E9F3EC", // soft green tint (header separation)
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 6,
  },

  title: {
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.soil,
  },

  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});