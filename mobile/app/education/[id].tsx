import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { EducationArticle } from "../../types/produce";
import { educationService } from "../../services/api/educationService";

const CATEGORY_COLORS: Record<string, string> = {
  "Soil Preparation": "#795548",
  "Pest Control": "#388E3C",
  Irrigation: "#1976D2",
  "Post-Harvest": "#F57C00",
  "Crop Disease": "#D32F2F",
  Fertilization: "#7B1FA2",
  Other: "#546E7A",
};

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<EducationArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      const data = await educationService.getById(Number(id));
      setArticle(data);
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.harvest} />
      </View>
    );
  }

  if (!article) return null;

  const catColor = CATEGORY_COLORS[article.category] ?? COLORS.clay;

  return (
    <View style={styles.container}>
      {/* Back button */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover image */}
        {article.coverImage ? (
          <Image
            source={{ uri: article.coverImage }}
            style={styles.coverImage}
          />
        ) : (
          <View
            style={[
              styles.coverPlaceholder,
              { backgroundColor: catColor + "22" },
            ]}
          >
            <Text style={styles.coverEmoji}>📖</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Category */}
          <View style={[styles.catBadge, { backgroundColor: catColor + "22" }]}>
            <Text style={[styles.catText, { color: catColor }]}>
              {article.category}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={COLORS.clay}
            />
            <Text style={styles.metaText}>
              {article.author.name} ·{" "}
              {new Date(article.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Sections */}
          {article.sections.map((section, index) => (
            <View key={`section-${article.id}-${index}`} style={styles.section}>
              {section.heading ? (
                <Text style={styles.sectionHeading}>{section.heading}</Text>
              ) : null}
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 16,
    zIndex: 10,
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
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  coverImage: { width: "100%", height: 240, resizeMode: "cover" },
  coverPlaceholder: {
    width: "100%",
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  coverEmoji: { fontSize: 60 },

  body: { padding: 20 },

  catBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  catText: { fontSize: 12, fontWeight: "700" },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.soil,
    lineHeight: 32,
    marginBottom: 12,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  metaText: { fontSize: 13, color: COLORS.clay },

  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },

  section: { marginBottom: 24 },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.soil,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    color: COLORS.bark,
    lineHeight: 24,
  },
});
