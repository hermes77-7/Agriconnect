import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useTransportStore } from "../../store/useTransportStore";
import { useAuthStore } from "../../store/useAuthStore";
import { TransportJob } from "../../types/produce";
import { router } from "expo-router";

type Tab = "available" | "active";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Pending: { bg: "#FFF8E1", color: "#F57F17" },
  In_Transit: { bg: "#E3F2FD", color: "#1565C0" },
  Delivered: { bg: "#E8F5E9", color: "#2E7D32" },
  Cancelled: { bg: "#F3F3F3", color: "#757575" },
};

function JobCard({
  job,
  isActive,
  onAccept,
  onUpdateStatus,
}: {
  job: TransportJob;
  isActive: boolean;
  onAccept?: () => void;
  onUpdateStatus?: (status: "In_Transit" | "Delivered") => void;
}) {
  const statusStyle = STATUS_STYLES[job.status] ?? STATUS_STYLES.Pending;

  return (
    <View style={styles.card}>
      {/* Top */}
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons
            name="truck-delivery-outline"
            size={22}
            color={COLORS.harvest}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardCrop}>{job.cropName || "Transport Job"}</Text>
          <View style={styles.routeRow}>
            <Ionicons name="location-outline" size={12} color={COLORS.clay} />
            <Text style={styles.cardMeta} numberOfLines={1}>
              {job.pickupLocation}
            </Text>
          </View>
          <View style={styles.routeRow}>
            <Ionicons
              name="navigate-outline"
              size={12}
              color={COLORS.harvest}
            />
            <Text style={styles.cardMeta} numberOfLines={1}>
              {job.destination}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>
            {job.status === "In_Transit" ? "In Transit" : job.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      {/* Details */}
      <View style={styles.cardDetails}>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Weight</Text>
          <Text style={styles.detailValue}>
            {job.estimatedWeight > 0 ? `${job.estimatedWeight} kg` : "—"}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Pay</Text>
          <Text style={styles.detailValue}>
            {job.price > 0 ? `${job.price.toLocaleString()} CFA` : "—"}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {job.transportDate
              ? new Date(job.transportDate).toLocaleDateString()
              : "Flexible"}
          </Text>
        </View>
      </View>

      {/* Cargo desc */}
      {job.cargoDesc ? (
        <View style={styles.cargoRow}>
          <Text style={styles.cargoText}>{job.cargoDesc}</Text>
        </View>
      ) : null}

      {/* Special instructions */}
      {job.specialInstructions ? (
        <View style={styles.cargoRow}>
          <Text style={styles.instrLabel}>Instructions: </Text>
          <Text style={styles.cargoText}>{job.specialInstructions}</Text>
        </View>
      ) : null}

      {/* Requester info */}
      <View style={styles.requesterRow}>
        <Ionicons name="person-outline" size={13} color={COLORS.clay} />
        <Text style={styles.requesterText}>
          {job.requestedBy.name} · {job.requestedBy.phone}
        </Text>
      </View>

      {/* Actions */}
      {!isActive && (
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptBtnText}>Accept Job</Text>
        </TouchableOpacity>
      )}

      {isActive && job.status === "In_Transit" && (
        <TouchableOpacity
          style={styles.deliveredBtn}
          onPress={() => onUpdateStatus?.("Delivered")}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={COLORS.white}
          />
          <Text style={styles.deliveredBtnText}>Mark as Delivered</Text>
        </TouchableOpacity>
      )}

      {isActive && job.status === "Delivered" && (
        <View style={styles.completedRow}>
          <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
          <Text style={styles.completedText}>Delivered</Text>
        </View>
      )}
    </View>
  );
}

export default function TransporterScreen() {
  const { user } = useAuthStore();
  const {
    availableJobs,
    myJobs,
    isLoading,
    fetchAvailableJobs,
    fetchMyJobs,
    acceptJob,
    updateStatus,
  } = useTransportStore();

  const [activeTab, setActiveTab] = useState<Tab>("available");

  useFocusEffect(
    useCallback(() => {
      fetchAvailableJobs();
      fetchMyJobs();
    }, []),
  );

  // Non-transporters see a locked screen
  if (user?.type !== "TRANSPORTER" && user?.type !== "ADMIN") {
    return (
      <View style={styles.lockedContainer}>
        <MaterialCommunityIcons
          name="truck-outline"
          size={56}
          color={COLORS.border}
        />
        <Text style={styles.lockedTitle}>Transporter Area</Text>
        <Text style={styles.lockedText}>
          This section is only accessible to registered transporters.
        </Text>
      </View>
    );
  }

  const handleAccept = (jobId: number) => {
    Alert.alert(
      "Accept Job",
      "Are you sure you want to accept this delivery job?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              await acceptJob(jobId);
              setActiveTab("active");
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.error || "Could not accept job",
              );
            }
          },
        },
      ],
    );
  };

  const handleUpdateStatus = (
    jobId: number,
    status: "In_Transit" | "Delivered",
  ) => {
    const label =
      status === "Delivered" ? "Mark as Delivered" : "Mark as In Transit";
    Alert.alert(label, "Confirm status update?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await updateStatus(jobId, status);
          } catch (err: any) {
            Alert.alert(
              "Error",
              err.response?.data?.error || "Could not update status",
            );
          }
        },
      },
    ]);
  };

  const displayedJobs = activeTab === "available" ? availableJobs : myJobs;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>LOGISTICS</Text>
        <Text style={styles.title}>Transport Hub</Text>
      </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push("/profile")}
          >
          <Ionicons name="person-outline" size={22} color={COLORS.soil} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "available" && styles.tabActive]}
          onPress={() => setActiveTab("available")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "available" && styles.tabTextActive,
            ]}
          >
            Available Jobs
          </Text>
          {availableJobs.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{availableJobs.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "active" && styles.tabTextActive,
            ]}
          >
            My Jobs
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : displayedJobs.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="truck-outline"
            size={48}
            color={COLORS.border}
          />
          <Text style={styles.emptyText}>
            {activeTab === "available"
              ? "No available jobs right now"
              : "No active jobs"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedJobs}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => {
                fetchAvailableJobs();
                fetchMyJobs();
              }}
              tintColor={COLORS.harvest}
            />
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              isActive={activeTab === "active"}
              onAccept={() => handleAccept(item.id)}
              onUpdateStatus={(status) => handleUpdateStatus(item.id, status)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },

  lockedContainer: {
    flex: 1,
    backgroundColor: COLORS.mist,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  lockedTitle: { fontSize: 20, fontWeight: "700", color: COLORS.soil },
  lockedText: {
    fontSize: 14,
    color: COLORS.clay,
    textAlign: "center",
    lineHeight: 21,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#E9F3EC",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

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
  cardCrop: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  cardMeta: { fontSize: 12, color: COLORS.clay, flex: 1 },
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

  cargoRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingBottom: 8,
    flexWrap: "wrap",
  },
  instrLabel: { fontSize: 12, fontWeight: "600", color: COLORS.soil },
  cargoText: { fontSize: 12, color: COLORS.clay, flex: 1 },

  requesterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  requesterText: { fontSize: 12, color: COLORS.clay },

  acceptBtn: {
    margin: 14,
    marginTop: 0,
    backgroundColor: COLORS.harvest,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  deliveredBtn: {
    margin: 14,
    marginTop: 0,
    backgroundColor: COLORS.moss,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deliveredBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    margin: 14,
    marginTop: 0,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
  },
  completedText: { fontSize: 14, fontWeight: "600", color: "#2E7D32" },
});
