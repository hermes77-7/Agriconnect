import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { useEffect, useState } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useAuthStore } from "../../store/useAuthStore";
import { useOrderStore } from "../../store/useOrderStore";
import { Order } from "../../types/produce";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { TransportCheck } from "../../types/produce";
import { transportService } from "../../services/api/transportService";

type Tab = "incoming" | "my";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Pending: { bg: "#FFF8E1", color: "#F57F17" },
  Accepted: { bg: "#E8F5E9", color: "#2E7D32" },
  Completed: { bg: "#E3F2FD", color: "#1565C0" },
  Cancelled: { bg: "#F3F3F3", color: "#757575" },
  Rejected: { bg: "#FFEBEE", color: "#C62828" },
};

function OrderCard({
  order,
  isFarmer,
  isIncoming,
  onAccept,
  onReject,
  onCancel,
  onComplete,
  transportCheck,
  onRequestTransport,
}: {
  order: Order;
  isFarmer: boolean;
  isIncoming: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  transportCheck?: TransportCheck;
  onRequestTransport?: () => void;
}) {
  const statusStyle = STATUS_STYLES[order.status] ?? STATUS_STYLES.Pending;

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <MaterialCommunityIcons name="sprout" size={22} color={COLORS.leaf} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardCrop}>{order.listing.cropName}</Text>
          <Text style={styles.cardMeta}>
            {isIncoming
              ? `From: ${order.buyer?.name} (${order.buyer?.type})`
              : `Farmer: ${order.farmer?.name}`}
          </Text>
          <Text style={styles.cardMeta}>
            {order.listing.pickupLocation}, {order.listing.region}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {order.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      {/* Details row */}
      <View style={styles.cardDetails}>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Quantity</Text>
          <Text style={styles.detailValue}>{order.quantityOrdered} kg</Text>
        </View>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Total</Text>
          <Text style={styles.detailValue}>
            {order.totalPrice.toLocaleString()} CFA
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* 1. Incoming Pending Actions (Farmer only) */}
      {isIncoming && order.status === "Pending" && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. INSERT YOUR SNIPPET HERE */}
      {/* Cancel — only on active orders (Pending/Accepted) */}
      {order.status === "Accepted" && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      {/* Complete — only on Accepted */}
      {order.status === "Accepted" && (
        <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={COLORS.white}
          />
          <Text style={styles.completeBtnText}>Mark as Completed</Text>
        </TouchableOpacity>
      )}

      {/* Request Transport — on accepted orders */}
      {order.status === "Accepted" && (
        <>
          {transportCheck?.exists ? (
            <View style={styles.transportStatusRow}>
              <MaterialCommunityIcons
                name="truck-outline"
                size={14}
                color={COLORS.moss}
              />
              <Text style={styles.transportStatusText}>
                Transport:{" "}
                {transportCheck.status === "In_Transit"
                  ? "In Transit"
                  : transportCheck.status}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.transportBtn}
              onPress={onRequestTransport}
            >
              <MaterialCommunityIcons
                name="truck-plus-outline"
                size={15}
                color={COLORS.white}
              />
              <Text style={styles.transportBtnText}>Request Transport</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const [transportStatus, setTransportStatus] = useState<Record<number, TransportCheck>>({}); 
  const { user } = useAuthStore();
  const {
    myOrders,
    incomingOrders,
    pendingCount,
    isLoading,
    fetchMyOrders,
    fetchIncomingOrders,
    fetchPendingCount,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    completeOrder,
  } = useOrderStore();

  const isFarmer = user?.type === "FARMER";
  const [activeTab, setActiveTab] = useState<Tab>(isFarmer ? "incoming" : "my");

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const checkTransportStatuses = async (orders: Order[]) => {
    const accepted = orders.filter((o) => o.status === "Accepted");
    const results: Record<number, TransportCheck> = {};
    await Promise.all(
      accepted.map(async (o) => {
        try {
          const check = await transportService.checkOrderTransport(o.id);
          results[o.id] = check;
        } catch {}
      }),
    );
    setTransportStatus(results);
  };

  const loadData = async () => {
    if (isFarmer) {
      await fetchIncomingOrders();
      await fetchPendingCount();
    }
    await fetchMyOrders();
    // Check transport for accepted orders
    const allOrders = [...myOrders, ...incomingOrders];
    await checkTransportStatuses(allOrders);
  };

  const [transportModal, setTransportModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [transportForm, setTransportForm] = useState({
    pickupLocation: "",
    destination: "",
    estimatedWeight: "",
    price: "",
    transportDate: "",
    specialInstructions: "",
  });
  const [submittingTransport, setSubmittingTransport] = useState(false);


  const handleRequestTransport = async () => {
    if (!selectedOrderId) return;
    if (!transportForm.pickupLocation || !transportForm.destination) {
      Alert.alert("Error", "Pickup location and destination are required");
      return;
    }

    setSubmittingTransport(true);
    try {
      await transportService.createJob({
        orderId: selectedOrderId,
        pickupLocation: transportForm.pickupLocation,
        destination: transportForm.destination,
        estimatedWeight: transportForm.estimatedWeight
          ? parseFloat(transportForm.estimatedWeight)
          : undefined,
        price: transportForm.price
          ? parseFloat(transportForm.price)
          : undefined,
        transportDate: transportForm.transportDate || undefined,
        specialInstructions: transportForm.specialInstructions || undefined,
      });
      setTransportModal(false);
      setTransportForm({
        pickupLocation: "",
        destination: "",
        estimatedWeight: "",
        price: "",
        transportDate: "",
        specialInstructions: "",
      });
      await loadData();
      Alert.alert(
        "Success",
        "Transport job posted. Transporters will be notified.",
      );
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not create transport job",
      );
    } finally {
      setSubmittingTransport(false);
    }
  };

  const handleAccept = (id: number) => {
    Alert.alert("Accept Order", "Are you sure you want to accept this order?", [
      { text: "Cancel", style: "cancel" },
      { text: "Accept", onPress: () => acceptOrder(id) },
    ]);
  };

  const handleReject = (id: number) => {
    Alert.alert("Reject Order", "Are you sure you want to reject this order?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectOrder(id) },
    ]);
  };

  const handleCancel = (id: number) => {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => cancelOrder(id),
      },
    ]);
  };

  const handleComplete = (id: number) => {
    Alert.alert(
      "Mark as Completed",
      "Confirm that this order has been fulfilled?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await completeOrder(id);
            } catch (err: any) {
              const message =
                err.response?.data?.error || "Could not complete this order";
              Alert.alert("Cannot Complete Order", message);
            }
          },
        },
      ],
    );
  };

  const displayedOrders = activeTab === "incoming" ? incomingOrders : myOrders;

const pendingOrders = displayedOrders.filter(
  (o) => o.status === "Pending" || o.status === "Accepted",
);

const historyOrders = displayedOrders.filter(
  (o) =>
    o.status === "Completed" ||
    o.status === "Cancelled" ||
    o.status === "Rejected",
);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MANAGE</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-outline" size={22} color={COLORS.soil} />
        </TouchableOpacity>
      </View>

      {/* Farmer tabs: Incoming / My Orders */}
      {isFarmer && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "incoming" && styles.tabActive]}
            onPress={() => setActiveTab("incoming")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "incoming" && styles.tabTextActive,
              ]}
            >
              Incoming
            </Text>
            {pendingCount > 0 && activeTab !== "incoming" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "my" && styles.tabActive]}
            onPress={() => setActiveTab("my")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "my" && styles.tabTextActive,
              ]}
            >
              My Orders
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : displayedOrders.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="clipboard-text-outline"
            size={48}
            color={COLORS.border}
          />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : (
        <FlatList
          data={[...pendingOrders, ...historyOrders]}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadData}
              tintColor={COLORS.harvest}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={48}
                color={COLORS.border}
              />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <>
              {index === 0 && pendingOrders.length > 0 && (
                <Text style={styles.sectionLabel}>Active</Text>
              )}
              {index === pendingOrders.length && historyOrders.length > 0 && (
                <Text style={styles.sectionLabel}>History</Text>
              )}
              <OrderCard
                order={item}
                isFarmer={isFarmer}
                isIncoming={activeTab === "incoming"}
                transportCheck={transportStatus[item.id]}
                onAccept={() => handleAccept(item.id)}
                onReject={() => handleReject(item.id)}
                onCancel={() => handleCancel(item.id)}
                onComplete={() => handleComplete(item.id)}
                onRequestTransport={() => {
                  setSelectedOrderId(item.id);
                  setTransportModal(true);
                }}
              />
            </>
          )}
        />
      )}

      {/* Transport Request Modal */}
      <Modal visible={transportModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setTransportModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Transport</Text>
              <TouchableOpacity onPress={() => setTransportModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.soil} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalFieldLabel}>Pickup Location *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Where to pick up the goods"
                placeholderTextColor={COLORS.clay}
                value={transportForm.pickupLocation}
                onChangeText={(v) =>
                  setTransportForm((p) => ({ ...p, pickupLocation: v }))
                }
              />

              <Text style={styles.modalFieldLabel}>Destination *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Delivery destination"
                placeholderTextColor={COLORS.clay}
                value={transportForm.destination}
                onChangeText={(v) =>
                  setTransportForm((p) => ({ ...p, destination: v }))
                }
              />

              <View style={styles.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 200"
                    placeholderTextColor={COLORS.clay}
                    value={transportForm.estimatedWeight}
                    onChangeText={(v) =>
                      setTransportForm((p) => ({ ...p, estimatedWeight: v }))
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>Pay (CFA)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 5000"
                    placeholderTextColor={COLORS.clay}
                    value={transportForm.price}
                    onChangeText={(v) =>
                      setTransportForm((p) => ({ ...p, price: v }))
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.modalFieldLabel}>Transport Date</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.clay}
                value={transportForm.transportDate}
                onChangeText={(v) =>
                  setTransportForm((p) => ({ ...p, transportDate: v }))
                }
              />

              <Text style={styles.modalFieldLabel}>Special Instructions</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70, textAlignVertical: "top" },
                ]}
                placeholder="Any special handling notes..."
                placeholderTextColor={COLORS.clay}
                value={transportForm.specialInstructions}
                onChangeText={(v) =>
                  setTransportForm((p) => ({ ...p, specialInstructions: v }))
                }
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  submittingTransport && { opacity: 0.6 },
                ]}
                onPress={handleRequestTransport}
                disabled={submittingTransport}
              >
                {submittingTransport ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    Post Transport Job
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#E9F3EC",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: "700", color: COLORS.soil },

  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: COLORS.harvest },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.clay },
  tabTextActive: { color: COLORS.harvest },
  badge: {
    backgroundColor: COLORS.harvest,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: COLORS.white },

  list: { padding: 16, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: { fontSize: 15, color: COLORS.clay, fontWeight: "500" },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

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
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardCrop: {
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
  cardDetails: { flexDirection: "row", padding: 14 },
  cardDetail: { flex: 1, alignItems: "center" },
  detailLabel: {
    fontSize: 10,
    color: COLORS.clay,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  detailValue: { fontSize: 13, fontWeight: "700", color: COLORS.soil },

  cardActions: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 0 },
  rejectBtn: {
    flex: 1,
    padding: 11,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#ff0026",
    borderColor: COLORS.border,
    alignItems: "center",
  },
  rejectBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.white },
  acceptBtn: {
    flex: 2,
    padding: 11,
    borderRadius: 22,
    backgroundColor: COLORS.mist,
    borderColor: "#ff0019",
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.clay },

  transportBtn: {
    margin: 14,
    marginTop: 0,
    backgroundColor: COLORS.bark,
    borderRadius: 12,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  transportBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.white },
  transportStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    margin: 14,
    marginTop: 0,
    padding: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    justifyContent: "center",
  },
  transportStatusText: { fontSize: 12, fontWeight: "600", color: COLORS.moss },

  cancelBtn: {
    margin: 14,
    marginTop: 0,
    padding: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ff0019",
    alignItems: "center",
    backgroundColor: "#ff0026",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 34,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  completeBtn: {
    margin: 14,
    marginTop: 0,
    padding: 11,
    borderRadius: 22,
    backgroundColor: COLORS.mist,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  completeBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.clay },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "ios" ? 50 : 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: COLORS.soil },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.soil,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.mist,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  modalRow: { flexDirection: "row", gap: 10 },
  modalConfirmBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  modalConfirmText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
});
