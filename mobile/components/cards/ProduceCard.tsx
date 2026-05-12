import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import { COLORS } from "../../constants/colors";

import { Produce } from "../../types/produce";

import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Props {
  item: Produce;
}

export default function ProduceCard({ item }: Props) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="sprout" size={28} color={COLORS.leaf} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>

        <Text style={styles.meta}>
          {item.quantity}
          {item.unit} • {item.region}
        </Text>
        <Text></Text>
        <Text style={styles.price}>{item.price} CFA</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    marginBottom: 16,
    padding: 16,
    borderTopLeftRadius: 0,
    borderRadius: 15,
    
    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 16,

    backgroundColor: COLORS.cream,

    justifyContent: "center",
    alignItems: "center",

    marginRight: 16,
  },

  info: {
    flex: 1,
  },

  name: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.soil,
  },

  meta: {
    marginTop: 4,
    color: COLORS.clay,
    fontSize: 14,
  },

  price: {
    fontWeight: "800",
    color: COLORS.harvest,
  },
});
