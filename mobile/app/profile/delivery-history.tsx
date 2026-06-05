import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { userService } from "../../services/api/userService";

export default function DeliveryHistoryScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getDeliveryHistory();
      setJobs(data);
      setFiltered(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text) {
      setFiltered(jobs);
      return;
    }
    const lower = text.toLowerCase();
    setFiltered(
      jobs.filter(
        (j) =>
          j.cropName?.toLowerCase().includes(lower) ||
          j.pickupLocation?.toLowerCase().includes(lower) ||
          j.destination?.toLowerCase().includes(lower) ||
          j.requestedBy?.name?.toLowerCase().includes(lower),
      ),
    );
  };

  const totalEarned = filtered.reduce((sum, j) => sum + (j.price ?? 0), 0);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isLast = index === filtered.length - 1;
    return (
      <View style={[styles.row, !isLast && styles.rowBorder]}>
        <View style={styles.rowIcon}>
          <MaterialCommunityIcons
            name="truck-check"
            size={18}
            color={COLORS.moss}
          />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowCrop} numberOfLines={1}>
              {item.cropName || "Transport Job"}
            </Text>
            <Text style={styles.rowDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.routeRow}>
            <Ionicons name="location-outline" size={11} color={COLORS.clay} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.pickupLocation}
            </Text>
            <Ionicons name="arrow-forward" size={11} color={COLORS.clay} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination}
            </Text>
          </View>
          <View style={styles.rowStats}>
            {item.estimatedWeight > 0 && (
              <Text style={styles.rowStat}>{item.estimatedWeight} kg</Text>
            )}
            {item.price > 0 && (
              <>
                <Text style={styles.rowStatDot}>·</Text>
                <Text
                  style={[
                    styles.rowStat,
                    { color: COLORS.moss, fontWeight: "700" },
                  ]}
                >
                  {item.price.toLocaleString()} CFA
                </Text>
              </>
            )}
            <Text style={styles.rowStatDot}>·</Text>
            <Text style={styles.rowStat}>{item.requestedBy?.name}</Text>
          </View>
        </View>
        <View style={styles.deliveredBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Earnings summary */}
      {filtered.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryNum}>{filtered.length}</Text>
            <Text style={styles.summaryLabel}>Deliveries</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNum, { color: COLORS.moss }]}>
              {totalEarned.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>CFA Earned</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={COLORS.clay} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search deliveries..."
          placeholderTextColor={COLORS.clay}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-circle" size={17} color={COLORS.clay} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🚚</Text>
          <Text style={styles.emptyTitle}>No deliveries yet</Text>
          <Text style={styles.emptyText}>
            Completed deliveries will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadHistory}
              tintColor={COLORS.harvest}
            />
          }
          renderItem={renderItem}
        />
      )}
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

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 22, fontWeight: "700", color: COLORS.soil },
  summaryLabel: { fontSize: 11, color: COLORS.clay, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: COLORS.border },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.soil },

  list: { paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.soil },
  emptyText: {
    fontSize: 13,
    color: COLORS.clay,
    textAlign: "center",
    lineHeight: 20,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.ghost },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  rowContent: { flex: 1, gap: 3 },
  rowTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowCrop: { fontSize: 14, fontWeight: "700", color: COLORS.soil, flex: 1 },
  rowDate: { fontSize: 11, color: COLORS.clay },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeText: { fontSize: 12, color: COLORS.clay, flex: 1 },
  rowStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowStat: { fontSize: 12, color: COLORS.soil },
  rowStatDot: { fontSize: 12, color: COLORS.clay },
  deliveredBadge: { flexShrink: 0 },
});
