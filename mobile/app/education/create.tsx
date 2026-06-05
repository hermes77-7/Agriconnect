import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { EducationCategory, ArticleSection } from "../../types/produce";
import { educationService } from "../../services/api/educationService";

const CATEGORIES: EducationCategory[] = [
  "Soil Preparation",
  "Pest Control",
  "Irrigation",
  "Post-Harvest",
  "Crop Disease",
  "Fertilization",
  "Other",
];

export default function CreateArticleScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EducationCategory>("Other");
  const [coverImage, setCoverImage] = useState("");
  const [sections, setSections] = useState<ArticleSection[]>([
    { heading: "", body: "" },
  ]);
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const addSection = () => {
    setSections((prev) => [...prev, { heading: "", body: "" }]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSection = (
    index: number,
    field: keyof ArticleSection,
    value: string,
  ) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    const validSections = sections.filter((s) => s.body.trim());
    if (validSections.length === 0) {
      Alert.alert("Error", "At least one section with content is required");
      return;
    }

    setSaving(true);
    try {
      await educationService.create({
        title: title.trim(),
        category,
        coverImage: coverImage.trim() || undefined,
        sections: validSections,
        isPublished,
      });
      Alert.alert("Success", "Article published successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Could not save article",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.soil} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Article</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Article title..."
            placeholderTextColor={COLORS.clay}
            value={title}
            onChangeText={setTitle}
          />

          {/* Category */}
          <Text style={styles.fieldLabel}>Category *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catChip,
                  category === cat && styles.catChipActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.catChipText,
                    category === cat && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cover image URL */}
          <Text style={styles.fieldLabel}>Cover Image URL (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor={COLORS.clay}
            value={coverImage}
            onChangeText={setCoverImage}
            autoCapitalize="none"
          />

          {/* Publish toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setIsPublished(!isPublished)}
          >
            <Text style={styles.fieldLabel}>Published</Text>
            <View style={[styles.toggle, isPublished && styles.toggleActive]}>
              <View
                style={[
                  styles.toggleThumb,
                  isPublished && styles.toggleThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Sections */}
          <View style={styles.sectionHeader}>
            <Text style={styles.fieldLabel}>Sections *</Text>
            <TouchableOpacity style={styles.addSectionBtn} onPress={addSection}>
              <Ionicons name="add" size={18} color={COLORS.harvest} />
              <Text style={styles.addSectionText}>Add Section</Text>
            </TouchableOpacity>
          </View>

          {sections.map((section, index) => (
            <View key={`create-section-${index}`} style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <Text style={styles.sectionNum}>Section {index + 1}</Text>
                {sections.length > 1 && (
                  <TouchableOpacity onPress={() => removeSection(index)}>
                    <Ionicons name="trash-outline" size={16} color="#C62828" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>Heading (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Section heading..."
                placeholderTextColor={COLORS.clay}
                value={section.heading}
                onChangeText={(v) => updateSection(index, "heading", v)}
              />

              <Text style={styles.fieldLabel}>Content *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write section content here..."
                placeholderTextColor={COLORS.clay}
                value={section.body}
                onChangeText={(v) => updateSection(index, "body", v)}
                multiline
                numberOfLines={5}
              />
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  saveBtn: {
    backgroundColor: COLORS.harvest,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  saveBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  scroll: { padding: 20 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.soil,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.soil,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  textArea: { height: 120, textAlignVertical: "top" },

  catScroll: { marginBottom: 14 },
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

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: COLORS.moss },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  toggleThumbActive: { alignSelf: "flex-end" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addSectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
  },
  addSectionText: { fontSize: 13, fontWeight: "600", color: COLORS.harvest },

  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionNum: { fontSize: 13, fontWeight: "700", color: COLORS.soil },
});
