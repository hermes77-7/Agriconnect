import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { Listing } from "../../types/produce";
import { listingService } from "../../services/api/listingService";
import { useAuthStore } from "../../store/useAuthStore";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderModal, setOrderModal] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const data = await listingService.getById(Number(id));
      setListing(data);
    } catch {
      Alert.alert("Error", "Could not load listing");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!listing) return;
    const qty = parseFloat(quantity);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    if (qty < listing.minOrderQty) {
      Alert.alert("Error", `Minimum order is ${listing.minOrderQty} kg`);
      return;
    }

    if (qty > listing.availableQty) {
      Alert.alert("Error", `Only ${listing.availableQty} kg available`);
      return;
    }

    setOrdering(true);
    try {
      const result = await listingService.placeOrder(listing.id, qty);
      setOrderModal(false);
      Alert.alert(
        "Order Placed!",
        `${qty} kg of ${listing.cropName}\nTotal: ${result.totalPrice.toLocaleString()} CFA`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert(
        "Order Failed",
        err.response?.data?.error || "Please try again",
      );
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.harvest} />
      </View>
    );
  }

  if (!listing) return null;

  const totalEstimate = quantity ? parseFloat(quantity) * listing.price : 0;
  const canOrder = user !== null && user.id !== listing.farmer.id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {listing.imageUrl ? (
            <Image source={{ uri: listing.imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderEmoji}>📦</Text>
            </View>
          )}
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{listing.category}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.cropName}>{listing.cropName}</Text>
            <View
              style={[
                styles.statusBadge,
                listing.status === "Available"
                  ? styles.statusGreen
                  : styles.statusOrange,
              ]}
            >
              <Text style={styles.statusText}>{listing.status}</Text>
            </View>
          </View>

          {/* Price */}
          <Text style={styles.price}>
            {listing.price.toLocaleString()}{" "}
            <Text style={styles.priceUnit}>CFA / kg</Text>
          </Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{listing.availableQty}</Text>
              <Text style={styles.statLabel}>kg available</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{listing.minOrderQty}</Text>
              <Text style={styles.statLabel}>kg min order</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{listing.totalQuantity}</Text>
              <Text style={styles.statLabel}>kg total</Text>
            </View>
          </View>

          {/* Farmer info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Farmer</Text>
            <View style={styles.farmerRow}>
              <View style={styles.farmerAvatar}>
                <Ionicons name="person" size={20} color={COLORS.clay} />
              </View>
              <View>
                <Text style={styles.farmerName}>{listing.farmer.name}</Text>
                <Text style={styles.farmerPhone}>{listing.farmer.phone}</Text>
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Location</Text>
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={COLORS.harvest}
              />
              <Text style={styles.locationText}>
                {listing.pickupLocation}, {listing.region}
              </Text>
            </View>
          </View>

          {/* Description */}
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Order button*/}
      {canOrder && listing.status === "Available" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.orderBtn}
            onPress={() => setOrderModal(true)}
          >
            <Text style={styles.orderBtnText}>Place Order</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Order Modal */}
      <Modal visible={orderModal} transparent animationType="slide">
        <TouchableWithoutFeedback
          onPress={() => {
            setOrderModal(false);
            setQuantity("");
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalSheet}
              >
                <Text style={styles.modalTitle}>Place Order</Text>
                <Text style={styles.modalSubtitle}>
                  {listing.cropName} · {listing.price.toLocaleString()} CFA/kg
                </Text>

                <Text style={styles.modalLabel}>
                  Quantity (kg) · Min: {listing.minOrderQty} kg
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`Enter quantity (max ${listing.availableQty} kg)`}
                  placeholderTextColor={COLORS.clay}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                {quantity && !isNaN(parseFloat(quantity)) && (
                  <View style={styles.estimate}>
                    <Text style={styles.estimateLabel}>Estimated Total</Text>
                    <Text style={styles.estimateAmount}>
                      {totalEstimate.toLocaleString()} CFA
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      setOrderModal(false);
                      setQuantity("");
                    }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirmBtn,
                      ordering && { opacity: 0.6 },
                    ]}
                    onPress={handleOrder}
                    disabled={ordering}
                  >
                    {ordering ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.modalConfirmText}>Confirm Order</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text></Text>
                <Text></Text>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBar: {
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
  imageContainer: { position: "relative" },
  image: { width: "100%", height: 220, resizeMode: "cover" },
  imagePlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderEmoji: { fontSize: 64 },
  categoryTag: {
    position: "absolute",
    bottom: 12,
    left: 16,
    backgroundColor: COLORS.soil,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryTagText: { color: COLORS.sun, fontSize: 12, fontWeight: "600" },
  body: { padding: 20 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cropName: { fontSize: 26, fontWeight: "700", color: COLORS.soil, flex: 1 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusGreen: { backgroundColor: "#E8F5E9" },
  statusOrange: { backgroundColor: "#FFF3E0" },
  statusText: { fontSize: 11, fontWeight: "700" },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.harvest,
    marginBottom: 16,
  },
  priceUnit: { fontSize: 14, fontWeight: "400", color: COLORS.clay },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNum: { fontSize: 18, fontWeight: "700", color: COLORS.soil },
  statLabel: { fontSize: 10, color: COLORS.clay, marginTop: 2 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  farmerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  farmerName: { fontSize: 15, fontWeight: "600", color: COLORS.soil },
  farmerPhone: { fontSize: 12, color: COLORS.clay, marginTop: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { fontSize: 14, color: COLORS.soil },
  description: { fontSize: 14, color: COLORS.clay, lineHeight: 21 },
  footer: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 35,
  },
  orderBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  orderBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 50 : 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 13, color: COLORS.clay, marginBottom: 20 },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.soil,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.mist,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  estimate: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  estimateLabel: { fontSize: 13, color: COLORS.clay, fontWeight: "500" },
  estimateAmount: { fontSize: 15, fontWeight: "700", color: COLORS.soil },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: COLORS.clay },
  modalConfirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.harvest,
    alignItems: "center",
  },
  modalConfirmText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});
