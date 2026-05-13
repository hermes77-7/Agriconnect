import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { COLORS } from "../../constants/colors";
import { Listing } from "../../types/produce";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const CATEGORY_ICON: Record<string, { lib: "ion" | "mci"; name: string }> = {
  Vegetables: { lib: "mci", name: "sprout"           },
  Grains:     { lib: "mci", name: "barley"            },
  Fruits:     { lib: "mci", name: "fruit-watermelon"  },
  Legumes:    { lib: "mci", name: "seed"              },
  Tubers:     { lib: "mci", name: "carrot"            },
  Spices:     { lib: "mci", name: "leaf"              },
  Dairy:      { lib: "mci", name: "cow"               },
  Other:      { lib: "ion", name: "basket-outline"    },
};

interface Props {
  item: Listing;
  onPress?: () => void;
}

export default function ProduceCard({ item, onPress }: Props) {
  const emoji = CATEGORY_ICON[item.category] ?? "📦";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Image or emoji fallback */}
      <View style={styles.imageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          (() => {
            const icon = CATEGORY_ICON[item.category] ?? CATEGORY_ICON["Other"];
            return icon.lib === "mci" ? (
              <MaterialCommunityIcons
                name={icon.name as any}
                size={34}
                color={COLORS.leaf}
              />
            ) : (
              <Ionicons name={icon.name as any} size={34} color={COLORS.leaf} />
            );
          })()
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.cropName}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.farmer}>
          by {item.farmer.name} · {item.region}
        </Text>

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.price}>
              {item.price.toLocaleString()}{" "}
              <Text style={styles.unit}>CFA/kg</Text>
            </Text>
            <Text style={styles.qty}>{item.availableQty} kg available</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    // Apple squircle enhancements:
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  
  imageWrap: {
    width: 90,
    height: 110,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: 90, height: 110, resizeMode: "cover" },
  emoji: { fontSize: 32 },
  info: { flex: 1, padding: 12, justifyContent: "space-between" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.soil, flex: 1 },
  categoryBadge: {
    backgroundColor: COLORS.cream,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  categoryText: { fontSize: 10, fontWeight: "600", color: COLORS.clay },
  farmer: { fontSize: 12, color: COLORS.clay, marginTop: 3 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
  },
  price: { fontSize: 16, fontWeight: "800", color: COLORS.soil },
  unit: { fontSize: 11, fontWeight: "400", color: COLORS.clay },
  qty: { fontSize: 11, color: COLORS.clay, marginTop: 2 },
});
