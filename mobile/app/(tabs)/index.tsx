import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useMarketplaceStore } from "../../store/useMarketplaceStore";
import { Category } from "../../types/produce";
import ProduceCard from "../../components/cards/ProduceCard";

const CATEGORIES: { label: string; value: Category | "" }[] = [
  { label: "All", value: "" },
  { label: "🥬 Vegetables", value: "Vegetables" },
  { label: "🌾 Grains", value: "Grains" },
  { label: "🍎 Fruits", value: "Fruits" },
  { label: "🫘 Legumes", value: "Legumes" },
  { label: "🍠 Tubers", value: "Tubers" },
  { label: "🌿 Spices", value: "Spices" },
  { label: "🥛 Dairy", value: "Dairy" },
];

export default function MarketplaceScreen() {
  const { listings, isLoading, fetchListings, setFilters, clearFilters } =
    useMarketplaceStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [region, setRegion] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    fetchListings();
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    setFilters({
      crop: text,
      category: selectedCategory,
      region,
      minPrice,
      maxPrice,
    });
  };

  const handleCategorySelect = (cat: Category | "") => {
    setSelectedCategory(cat);
    setFilters({
      crop: search,
      category: cat,
      region,
      minPrice,
      maxPrice,
    });
  };

  const handleApplyFilters = () => {
    setFilters({
      crop: search,
      category: selectedCategory,
      region,
      minPrice,
      maxPrice,
    });
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setRegion("");
    setMinPrice("");
    setMaxPrice("");
    clearFilters();
    setShowFilters(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>AGRICONNECT MARKET</Text>
            <Text style={styles.title}>Fresh Produce</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/auth/login")}
          >
            <Ionicons name="person-outline" size={22} color={COLORS.soil} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.clay} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search crops, regions..."
            placeholderTextColor={COLORS.clay}
            value={search}
            onChangeText={handleSearch}
          />
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
            <Ionicons
              name="options-outline"
              size={20}
              color={showFilters ? COLORS.harvest : COLORS.clay}
            />
          </TouchableOpacity>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.chip,
                selectedCategory === cat.value && styles.chipActive,
              ]}
              onPress={() => handleCategorySelect(cat.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat.value && styles.chipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>Filter Listings</Text>

          <Text style={styles.filterLabel}>Region</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="e.g. Yaoundé, Douala"
            placeholderTextColor={COLORS.clay}
            value={region}
            onChangeText={setRegion}
          />

          <Text style={styles.filterLabel}>Price Range (CFA/kg)</Text>
          <View style={styles.filterRow}>
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="Min"
              placeholderTextColor={COLORS.clay}
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
            />
            <Text style={styles.filterSep}>—</Text>
            <TextInput
              style={[styles.filterInput, { flex: 1 }]}
              placeholder="Max"
              placeholderTextColor={COLORS.clay}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApplyFilters}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Listings */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No listings found</Text>
          <TouchableOpacity onPress={() => fetchListings()}>
            <Text style={styles.retryText}>Tap to refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => fetchListings()}
              tintColor={COLORS.harvest}
            />
          }
          renderItem={({ item }) => (
            <ProduceCard
              item={item}
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },
  headerContainer: {
    backgroundColor: "#E9F3EC",
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: "700", color: COLORS.soil },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.soil },
  chipsScroll: { marginBottom: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.soil, borderColor: COLORS.soil },
  chipText: { fontSize: 12, fontWeight: "500", color: COLORS.clay },
  chipTextActive: { color: COLORS.sun },

  filterPanel: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.clay,
    marginBottom: 6,
  },
  filterInput: {
    backgroundColor: COLORS.mist,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterSep: { color: COLORS.clay, fontSize: 16 },
  filterActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  clearBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  clearBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.clay },
  applyBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.harvest,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.white },

  listContent: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 15, color: COLORS.clay, fontWeight: "500" },
  retryText: { fontSize: 13, color: COLORS.harvest, fontWeight: "600" },
});
