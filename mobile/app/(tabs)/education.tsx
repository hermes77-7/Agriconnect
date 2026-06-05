import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { useEducationStore } from "../../store/useEducationStore";
import { useAuthStore } from "../../store/useAuthStore";
import { EducationArticle, EducationCategory } from "../../types/produce";

const CATEGORIES: { label: string; value: EducationCategory | "" }[] = [
  { label: "All", value: "" },
  { label: "🌱 Soil Prep", value: "Soil Preparation" },
  { label: "🐛 Pest Control", value: "Pest Control" },
  { label: "💧 Irrigation", value: "Irrigation" },
  { label: "📦 Post-Harvest", value: "Post-Harvest" },
  { label: "🦠 Crop Disease", value: "Crop Disease" },
  { label: "🧪 Fertilization", value: "Fertilization" },
  { label: "📖 Other", value: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Soil Preparation": "#795548",
  "Pest Control": "#388E3C",
  Irrigation: "#1976D2",
  "Post-Harvest": "#F57C00",
  "Crop Disease": "#D32F2F",
  Fertilization: "#7B1FA2",
  Other: "#546E7A",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  "Soil Preparation": "🌱",
  "Pest Control": "🐛",
  Irrigation: "💧",
  "Post-Harvest": "📦",
  "Crop Disease": "🦠",
  Fertilization: "🧪",
  Other: "📖",
};

function ArticleRow({
  article,
  isAdmin,
  onPress,
  onDelete,
  isLast,
}: {
  article: EducationArticle;
  isAdmin: boolean;
  onPress: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const catColor = CATEGORY_COLORS[article.category] ?? COLORS.clay;
  const emoji = CATEGORY_EMOJIS[article.category] ?? "📖";
  const preview = article.sections?.[0]?.body?.slice(0, 80) ?? "";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      {/* Left: emoji circle */}
      <View style={[styles.rowEmoji, { backgroundColor: catColor + "18" }]}>
        <Text style={styles.rowEmojiText}>{emoji}</Text>
      </View>

      {/* Middle: content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTopLine}>
          <Text
            style={[styles.rowCategory, { color: catColor }]}
            numberOfLines={1}
          >
            {article.category.toUpperCase()}
          </Text>
          <Text style={styles.rowDate}>
            {new Date(article.createdAt).toLocaleDateString("fr-CM", {
              day: "numeric",
              month: "short",
            })}
          </Text>
        </View>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {article.title}
        </Text>
        {preview ? (
          <Text style={styles.rowPreview} numberOfLines={1}>
            {preview}...
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <Text style={styles.rowAuthor}>By {article.author.name}</Text>
          <Text style={styles.rowSections}>
            {article.sections?.length ?? 0} section
            {(article.sections?.length ?? 0) !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Right: actions */}
      <View style={styles.rowRight}>
        {isAdmin && (
          <TouchableOpacity
            style={styles.rowDeleteBtn}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={15} color="#C62828" />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
      </View>
    </TouchableOpacity>
  );
}

function CategoryDivider({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? COLORS.clay;
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: color + "40" }]} />
      <Text style={[styles.dividerLabel, { color }]}>
        {CATEGORY_EMOJIS[category]} {category}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: color + "40" }]} />
    </View>
  );
}

export default function EducationScreen() {
  const { user } = useAuthStore();
  const {
    articles,
    isLoading,
    fetchArticles,
    setCategory,
    selectedCategory,
    deleteArticle,
  } = useEducationStore();

  const [search, setSearch] = useState("");
  const isAdmin = user?.type === "ADMIN";

  useFocusEffect(
    useCallback(() => {
      fetchArticles({ category: selectedCategory });
    }, []),
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    fetchArticles({ category: selectedCategory, search: text });
  };

  const handleDelete = (article: EducationArticle) => {
    Alert.alert("Delete Article", `Delete "${article.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteArticle(article.id);
          } catch {
            Alert.alert("Error", "Could not delete article");
          }
        },
      },
    ]);
  };

  // Group articles by category when no filter is active
  const groupedSections = () => {
    if (selectedCategory !== "" || search !== "") {
      return [{ title: "", data: articles }];
    }
    const groups: Record<string, EducationArticle[]> = {};
    articles.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return Object.entries(groups).map(([cat, data]) => ({
      title: cat,
      data,
    }));
  };

  const sections = groupedSections();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>KNOWLEDGE HUB</Text>
          <Text style={styles.title}>Farming Guide</Text>
        </View>
        <View style={styles.headerRight}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push("/education/create")}
            >
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push("/profile")}
          >
            <Ionicons name="person-outline" size={20} color={COLORS.soil} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={COLORS.clay} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search articles..."
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
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.chip,
              selectedCategory === cat.value && styles.chipActive,
            ]}
            onPress={() => setCategory(cat.value as EducationCategory | "")}
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

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {articles.length} article{articles.length !== 1 ? "s" : ""}
          {selectedCategory ? ` in ${selectedCategory}` : ""}
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.harvest} />
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptyText}>
            {isAdmin
              ? "Tap + to publish the first article"
              : "Check back soon for farming guides"}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() =>
                fetchArticles({ category: selectedCategory, search })
              }
              tintColor={COLORS.harvest}
            />
          }
          renderSectionHeader={({ section }) =>
            section.title ? <CategoryDivider category={section.title} /> : null
          }
          renderItem={({ item, index, section }) => (
            <ArticleRow
              article={item}
              isAdmin={isAdmin}
              isLast={index === section.data.length - 1}
              onPress={() => router.push(`/education/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.mist },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#E9F3EC",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {},
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: COLORS.harvest,
    marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: "700", color: COLORS.soil },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.harvest,
    justifyContent: "center",
    alignItems: "center",
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  searchWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.soil },

  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
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

  statsBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  statsText: { fontSize: 11, color: COLORS.clay, fontWeight: "500" },

  listContent: { paddingBottom: 100 },

  // Section divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  // Article row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ghost,
  },
  rowEmoji: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  rowEmojiText: { fontSize: 22 },
  rowContent: { flex: 1, gap: 3 },
  rowTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowCategory: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  rowDate: { fontSize: 10, color: COLORS.clay },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.soil,
    lineHeight: 20,
  },
  rowPreview: { fontSize: 12, color: COLORS.clay, lineHeight: 17 },
  rowMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  rowAuthor: { fontSize: 11, color: COLORS.clay },
  rowSections: { fontSize: 11, color: COLORS.clay },
  rowRight: { alignItems: "center", gap: 8, flexShrink: 0 },
  rowDeleteBtn: { padding: 4 },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: COLORS.soil },
  emptyText: {
    fontSize: 13,
    color: COLORS.clay,
    textAlign: "center",
    lineHeight: 20,
  },
});
