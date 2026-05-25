import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useAuthStore } from "../../store/useAuthStore";
import { useAnalysisStore } from "../../store/useAnalysisStore";
import { CropAnalysis } from "../../types/produce";
import { api } from "../../services/api/client";

const RESULT_STYLES: Record<
  string,
  { bg: string; color: string; icon: string }
> = {
  Healthy: { bg: "#E8F5E9", color: "#2E7D32", icon: "leaf" },
  Diseased: { bg: "#FFEBEE", color: "#C62828", icon: "alert-circle" },
  "Nutrient Deficiency": {
    bg: "#FFF8E1",
    color: "#F57F17",
    icon: "flask-outline",
  },
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const barColor =
    pct >= 85 ? COLORS.moss : pct >= 70 ? COLORS.harvest : "#E65100";

  return (
    <View style={styles.confContainer}>
      <View style={styles.confLabelRow}>
        <Text style={styles.confLabel}>Confidence</Text>
        <Text style={[styles.confPct, { color: barColor }]}>{pct}%</Text>
      </View>
      <View style={styles.confTrack}>
        <View
          style={[
            styles.confFill,
            { width: `${pct}%` as any, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

function ResultCard({ analysis }: { analysis: CropAnalysis }) {
  const style = RESULT_STYLES[analysis.result] ?? RESULT_STYLES["Healthy"];

  return (
    <View style={styles.resultCard}>
      {/* Result header */}
      <View style={[styles.resultHeader, { backgroundColor: style.bg }]}>
        <Ionicons name={style.icon as any} size={28} color={style.color} />
        <View style={styles.resultHeaderText}>
          <Text style={styles.resultCrop}>{analysis.cropName}</Text>
          <Text style={[styles.resultStatus, { color: style.color }]}>
            {analysis.result}
          </Text>
        </View>
        <Text style={styles.resultDate}>
          {new Date(analysis.analyzedAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Confidence */}
      <View style={styles.resultBody}>
        <ConfidenceBar confidence={analysis.confidence} />

        {/* Recommendations */}
        <Text style={styles.recsTitle}>Recommendations</Text>
        {analysis.recommendations.map((rec, i) => (
          <View key={`rec-${analysis.id}-${i}`} style={styles.recRow}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{rec}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryCard({
  analysis,
  onPress,
}: {
  analysis: CropAnalysis;
  onPress: () => void;
}) {
  const style = RESULT_STYLES[analysis.result] ?? RESULT_STYLES["Healthy"];

  return (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.historyIcon, { backgroundColor: style.bg }]}>
        <Ionicons name={style.icon as any} size={20} color={style.color} />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyCrop}>{analysis.cropName}</Text>
        <Text style={styles.historyDate}>
          {new Date(analysis.analyzedAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.historyRight}>
        <View style={[styles.historyBadge, { backgroundColor: style.bg }]}>
          <Text style={[styles.historyBadgeText, { color: style.color }]}>
            {analysis.result}
          </Text>
        </View>
        <Text style={styles.historyConf}>
          {Math.round(analysis.confidence * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AnalysisScreen() {
  const { user } = useAuthStore();
  const { history, isAnalyzing, fetchHistory, analyze } = useAnalysisStore();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cropName, setCropName] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<CropAnalysis | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<CropAnalysis | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      if (user?.type === "FARMER") fetchHistory();
    }, [user]),
  );

  // Non-farmers see locked screen
  if (user?.type !== "FARMER") {
    return (
      <View style={styles.lockedContainer}>
        <MaterialCommunityIcons
          name="leaf-circle-outline"
          size={56}
          color={COLORS.border}
        />
        <Text style={styles.lockedTitle}>Crop Analysis</Text>
        <Text style={styles.lockedText}>
          This feature is only available to registered farmers.
        </Text>
      </View>
    );
  }

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow camera access");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      Alert.alert("No Image", "Please select or capture a crop image first");
      return;
    }
    if (!cropName.trim()) {
      Alert.alert("Crop Name Required", "Please enter the name of the crop");
      return;
    }

    try {
      const result = await analyze(selectedImage, cropName.trim());
      setCurrentResult(result);
      setShowResult(true);
      setSelectedImage(null);
      setCropName("");
    } catch (err: any) {
      Alert.alert(
        "Analysis Failed",
        err.response?.data?.error ||
          "Could not analyze image. Please try again.",
      );
    }
  };

  const baseUrl = (api.defaults.baseURL ?? "").replace("/api", "");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AI-POWERED · C++ ENGINE</Text>
        <Text style={styles.title}>Crop Diagnosis</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Upload section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Analysis</Text>

          {/* Image picker */}
          <TouchableOpacity
            style={styles.imagePicker}
            onPress={handlePickImage}
            activeOpacity={0.85}
          >
            {selectedImage ? (
              <Image
                source={{ uri: selectedImage }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.scanCornerTL} />
                <View style={styles.scanCornerTR} />
                <View style={styles.scanCornerBL} />
                <View style={styles.scanCornerBR} />
                <Ionicons name="image-outline" size={40} color={COLORS.clay} />
                <Text style={styles.imagePickerText}>Tap to select image</Text>
                <Text style={styles.imagePickerHint}>
                  JPEG or PNG · Max 10MB
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Camera / Change buttons */}
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.imageActionBtn}
              onPress={handleTakePhoto}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={COLORS.harvest}
              />
              <Text style={styles.imageActionText}>Take Photo</Text>
            </TouchableOpacity>
            {selectedImage && (
              <TouchableOpacity
                style={styles.imageActionBtn}
                onPress={handlePickImage}
              >
                <Ionicons name="images-outline" size={18} color={COLORS.clay} />
                <Text style={[styles.imageActionText, { color: COLORS.clay }]}>
                  Change
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Crop name input */}
          <Text style={styles.fieldLabel}>Crop Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maize, Tomato, Cassava..."
            placeholderTextColor={COLORS.clay}
            value={cropName}
            onChangeText={setCropName}
          />

          {/* Analyze button */}
          <TouchableOpacity
            style={[
              styles.analyzeBtn,
              (!selectedImage || !cropName || isAnalyzing) &&
                styles.analyzeBtnDisabled,
            ]}
            onPress={handleAnalyze}
            disabled={!selectedImage || !cropName || isAnalyzing}
          >
            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color={COLORS.white} size="small" />
                <Text style={styles.analyzeBtnText}>Analyzing...</Text>
              </View>
            ) : (
              <View style={styles.analyzingRow}>
                <MaterialCommunityIcons
                  name="leaf-circle-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.analyzeBtnText}>Analyze Crop</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Past Analyses</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Clear History",
                    "Delete all your analysis history?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear All",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await useAnalysisStore.getState().clearHistory();
                          } catch {
                            Alert.alert("Error", "Could not clear history");
                          }
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.clearHistoryBtn}>Clear All</Text>
              </TouchableOpacity>
            </View>
            {history
              .filter((item) => item && item.id !== undefined)
              .map((item, index) => (
                <View key={`history-${item.id ?? index}`}>
                  <HistoryCard
                    analysis={item}
                    onPress={() => setSelectedHistory(item)}
                  />
                </View>
              ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Result Modal */}
      <Modal visible={showResult} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Analysis Result</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowResult(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.soil} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {currentResult && <ResultCard analysis={currentResult} />}
          </ScrollView>
        </View>
      </Modal>

      {/* History Detail Modal */}
      <Modal visible={selectedHistory !== null} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Analysis Detail</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedHistory(null)}
            >
              <Ionicons name="close" size={24} color={COLORS.soil} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {selectedHistory && <ResultCard analysis={selectedHistory} />}
          </ScrollView>
        </View>
      </Modal>
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#E9F3EC",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: "700", color: COLORS.soil },

  section: { padding: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
  },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  clearHistoryBtn: {
    fontSize: 13,
    fontWeight: "600",
    color: "#C62828",
  },
  
  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.harvest,
    borderStyle: "dashed",
  },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
  },
  imagePickerText: { fontSize: 14, fontWeight: "600", color: COLORS.clay },
  imagePickerHint: { fontSize: 11, color: COLORS.clay, opacity: 0.6 },

  // Scanner corner brackets
  scanCornerTL: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.harvest,
    borderTopLeftRadius: 4,
  },
  scanCornerTR: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.harvest,
    borderTopRightRadius: 4,
  },
  scanCornerBL: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.harvest,
    borderBottomLeftRadius: 4,
  },
  scanCornerBR: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.harvest,
    borderBottomRightRadius: 4,
  },

  imageActions: { flexDirection: "row", gap: 10, marginBottom: 16 },
  imageActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageActionText: { fontSize: 13, fontWeight: "600", color: COLORS.harvest },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.soil,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },

  analyzeBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyzeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  // History cards
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  historyInfo: { flex: 1 },
  historyCrop: { fontSize: 14, fontWeight: "600", color: COLORS.soil },
  historyDate: { fontSize: 12, color: COLORS.clay, marginTop: 2 },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  historyBadgeText: { fontSize: 10, fontWeight: "700" },
  historyConf: { fontSize: 11, color: COLORS.clay },

  // Result card
  resultCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    margin: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 14,
  },
  resultHeaderText: { flex: 1 },
  resultCrop: { fontSize: 18, fontWeight: "700", color: COLORS.soil },
  resultStatus: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  resultDate: { fontSize: 11, color: COLORS.clay },
  resultBody: { padding: 20 },

  confContainer: { marginBottom: 20 },
  confLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  confLabel: { fontSize: 12, fontWeight: "600", color: COLORS.clay },
  confPct: { fontSize: 12, fontWeight: "700" },
  confTrack: {
    height: 6,
    backgroundColor: COLORS.ghost,
    borderRadius: 6,
    overflow: "hidden",
  },
  confFill: { height: "100%", borderRadius: 6 },

  recsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.clay,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  recRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    alignItems: "flex-start",
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.harvest,
    marginTop: 6,
  },
  recText: { flex: 1, fontSize: 13, color: COLORS.soil, lineHeight: 20 },

  // Modals
  modalContainer: { flex: 1, backgroundColor: COLORS.mist },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.mist,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.soil },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalScroll: { paddingBottom: 40 },
});
