import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { Listing, Category } from "../../types/produce";
import { listingService } from "../../services/api/listingService";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

const CATEGORIES: Category[] = [
  "Fruits",
  "Vegetables",
  "Grains",
  "Legumes",
  "Tubers",
  "Spices",
  "Dairy",
  "Other",
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Available: { bg: "#E8F5E9", color: "#2E7D32" },
  Reserved: { bg: "#FFF3E0", color: "#E65100" },
  Sold: { bg: "#F3F3F3", color: "#757575" },
};

interface ListingFormData {
  cropName: string;
  category: Category;
  totalQuantity: string;
  minOrderQty: string;
  price: string;
  pickupLocation: string;
  region: string;
  description: string;
}

const EMPTY_FORM: ListingFormData = {
  cropName: "",
  category: "Vegetables",
  totalQuantity: "",
  minOrderQty: "",
  price: "",
  pickupLocation: "",
  region: "",
  description: "",
};

export default function MyListingsScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filtered, setFiltered] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ListingFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, []),
  );

  useEffect(() => {
    if (!search) {
      setFiltered(listings);
      return;
    }
    setFiltered(
      listings.filter(
        (l) =>
          l.cropName.toLowerCase().includes(search.toLowerCase()) ||
          l.region.toLowerCase().includes(search.toLowerCase()) ||
          l.category.toLowerCase().includes(search.toLowerCase()),
      ),
    );
  }, [search, listings]);

  const loadListings = async () => {
    setIsLoading(true);
    try {
      const data = await listingService.getFarmerListings();
      setListings(data);
      setFiltered(data);
    } catch {
      Alert.alert("Error", "Could not load your listings");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setForm({
      cropName: listing.cropName,
      category: listing.category,
      totalQuantity: listing.totalQuantity.toString(),
      minOrderQty: listing.minOrderQty.toString(),
      price: listing.price.toString(),
      pickupLocation: listing.pickupLocation,
      region: listing.region,
      description: listing.description ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (
      !form.cropName ||
      !form.pickupLocation ||
      !form.totalQuantity ||
      !form.price
    ) {
      Alert.alert(
        "Error",
        "Crop name, pickup location, quantity and price are required",
      );
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await listingService.update(editingId, {
          cropName: form.cropName,
          category: form.category,
          totalQuantity: parseFloat(form.totalQuantity),
          minOrderQty: parseFloat(form.minOrderQty) || 1,
          price: parseFloat(form.price),
          pickupLocation: form.pickupLocation,
          region: form.region,
          description: form.description,
        });
      } else {
        await listingService.create({
          cropName: form.cropName,
          category: form.category,
          totalQuantity: parseFloat(form.totalQuantity),
          minOrderQty: parseFloat(form.minOrderQty) || 1,
          price: parseFloat(form.price),
          pickupLocation: form.pickupLocation,
          region: form.region,
          description: form.description,
        });
      }
      setShowModal(false);
      await loadListings();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not save listing",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (listing: Listing) => {
    Alert.alert(
      "Delete Listing",
      `Are you sure you want to delete "${listing.cropName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await listingService.delete(listing.id);
              await loadListings();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.error || "Could not delete listing",
              );
            }
          },
        },
      ],
    );
  };

  const updateForm = (key: keyof ListingFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderListing = ({ item }: { item: Listing }) => {
    const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.Available;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardIcon}>
            <MaterialCommunityIcons
              name="sprout"
              size={22}
              color={COLORS.leaf}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.cropName}</Text>
            <Text style={styles.cardMeta}>
              {item.category} · {item.region}
            </Text>
            <Text style={styles.cardMeta}>{item.pickupLocation}</Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
          >
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.statVal}>{item.availableQty} kg</Text>
            <Text style={styles.statLbl}>Available</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.statVal}>{item.price.toLocaleString()}</Text>
            <Text style={styles.statLbl}>CFA/kg</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.statVal}>{item.minOrderQty} kg</Text>
            <Text style={styles.statLbl}>Min Order</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => openEdit(item)}
          >
            <Ionicons name="pencil-outline" size={15} color={COLORS.harvest} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={15} color="#C62828" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>My Listings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.clay} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your listings..."
          placeholderTextColor={COLORS.clay}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.clay} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="sprout-outline"
            size={48}
            color={COLORS.border}
          />
          <Text style={styles.emptyText}>
            {search
              ? "No listings match your search"
              : "You have no listings yet"}
          </Text>
          {!search && (
            <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
              <Text style={styles.createBtnText}>
                Create Your First Listing
              </Text>
            </TouchableOpacity>
          )}
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
              onRefresh={loadListings}
              tintColor={COLORS.harvest}
            />
          }
          renderItem={renderListing}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowModal(false)}
          />
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Listing" : "New Listing"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.soil} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Crop Name */}
              <Text style={styles.fieldLabel}>Crop Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Organic Cabbage"
                placeholderTextColor={COLORS.clay}
                value={form.cropName}
                onChangeText={(v) => updateForm("cropName", v)}
              />

              {/* Category */}
              <Text style={styles.fieldLabel}>Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      form.category === cat && styles.catChipActive,
                    ]}
                    onPress={() => updateForm("category", cat)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        form.category === cat && styles.catChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quantity row */}
              <View style={styles.row}>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Total Quantity (kg) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    placeholderTextColor={COLORS.clay}
                    value={form.totalQuantity}
                    onChangeText={(v) => updateForm("totalQuantity", v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Min Order (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10"
                    placeholderTextColor={COLORS.clay}
                    value={form.minOrderQty}
                    onChangeText={(v) => updateForm("minOrderQty", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Price */}
              <Text style={styles.fieldLabel}>Price per kg (CFA) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 450"
                placeholderTextColor={COLORS.clay}
                value={form.price}
                onChangeText={(v) => updateForm("price", v)}
                keyboardType="numeric"
              />

              {/* Location row */}
              <View style={styles.row}>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Pickup Location *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Mfoundi Market"
                    placeholderTextColor={COLORS.clay}
                    value={form.pickupLocation}
                    onChangeText={(v) => updateForm("pickupLocation", v)}
                  />
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.fieldLabel}>Region</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Yaounde"
                    placeholderTextColor={COLORS.clay}
                    value={form.region}
                    onChangeText={(v) => updateForm("region", v)}
                  />
                </View>
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add details about your produce..."
                placeholderTextColor={COLORS.clay}
                value={form.description}
                onChangeText={(v) => updateForm("description", v)}
                multiline
                numberOfLines={3}
              />

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Save Changes" : "Create Listing"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.harvest,
    justifyContent: "center",
    alignItems: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.soil },

  list: { padding: 16, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.clay,
    fontWeight: "500",
    textAlign: "center",
  },
  createBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  createBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 3,
  },
  cardMeta: { fontSize: 12, color: COLORS.clay, marginBottom: 1 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  cardDivider: { height: 1, backgroundColor: COLORS.ghost },
  cardStats: { flexDirection: "row", padding: 14 },
  cardStat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 14, fontWeight: "700", color: COLORS.soil },
  statLbl: { fontSize: 10, color: COLORS.clay, marginTop: 2 },

  cardActions: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 0 },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.harvest,
  },
  editBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.harvest },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    backgroundColor: "#FFEBEE",
  },
  deleteBtnText: { fontSize: 13, fontWeight: "600", color: "#C62828" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: COLORS.soil },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.soil,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.mist,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  textArea: { height: 80, textAlignVertical: "top" },

  categoryScroll: { marginBottom: 14 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: COLORS.soil, borderColor: COLORS.soil },
  catChipText: { fontSize: 12, fontWeight: "500", color: COLORS.clay },
  catChipTextActive: { color: COLORS.sun },

  row: { flexDirection: "row", gap: 10 },
  rowField: { flex: 1 },

  saveBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});
