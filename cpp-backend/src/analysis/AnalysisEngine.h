#pragma once
#include <string>
#include <vector>
#include <random>
#include <algorithm>

struct AnalysisResult {
    std::string result;
    float confidence;
    std::vector<std::string> recommendations;
};

class AnalysisEngine {
public:
    // Simulated analysis based on image file size and name hints
    // In production this is replaced with real OpenCV texture analysis
    static AnalysisResult analyze(const std::string& imagePath,
                                   const std::string& cropName,
                                   size_t imageSizeBytes) {

        // Use image size as a seed for reproducible results per image
        std::mt19937 rng(static_cast<unsigned>(imageSizeBytes));
        std::uniform_real_distribution<float> dist(0.0f, 1.0f);
        float roll = dist(rng);

        AnalysisResult res;

        // Weighted outcome distribution
        // 60% healthy, 25% diseased, 15% nutrient deficiency
        if (roll < 0.60f) {
            res.result     = "Healthy";
            res.confidence = 0.85f + (dist(rng) * 0.14f); // 0.85 - 0.99
            res.recommendations = {
                "Continue current watering schedule",
                "Apply standard fertilization every 2 weeks",
                "Monitor for early signs of pests",
                "Ensure adequate sunlight exposure"
            };
        } else if (roll < 0.85f) {
            res.result     = "Diseased";
            res.confidence = 0.75f + (dist(rng) * 0.20f); // 0.75 - 0.95
            res.recommendations = buildDiseaseRecommendations(cropName, rng, dist);
        } else {
            res.result     = "Nutrient Deficiency";
            res.confidence = 0.70f + (dist(rng) * 0.25f); // 0.70 - 0.95
            res.recommendations = {
                "Apply nitrogen-rich fertilizer immediately",
                "Check soil pH levels (optimal: 6.0-7.0)",
                "Consider foliar feeding with micronutrients",
                "Increase organic matter in soil",
                "Consult local agricultural extension office"
            };
        }

        // Cap confidence at 0.99
        res.confidence = std::min(res.confidence, 0.99f);
        return res;
    }

private:
    static std::vector<std::string> buildDiseaseRecommendations(
        const std::string& cropName,
        std::mt19937& rng,
        std::uniform_real_distribution<float>& dist)
    {
        // Generic disease recommendations
        std::vector<std::string> recs = {
            "Isolate affected plants immediately to prevent spread",
            "Remove and destroy visibly infected leaves or stems",
            "Apply appropriate fungicide or bactericide",
            "Improve air circulation around plants",
            "Avoid overhead watering to reduce moisture on leaves",
            "Consult an agronomist for specific treatment plan"
        };

        // Crop-specific additions
        std::string lower = cropName;
        std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

        if (lower.find("tomato") != std::string::npos ||
            lower.find("tomate") != std::string::npos) {
            recs.push_back("Check for late blight (Phytophthora infestans)");
            recs.push_back("Apply copper-based fungicide weekly");
        } else if (lower.find("maize") != std::string::npos ||
                   lower.find("corn") != std::string::npos ||
                   lower.find("mais") != std::string::npos) {
            recs.push_back("Inspect for maize streak virus symptoms");
            recs.push_back("Control aphid population with insecticide");
        } else if (lower.find("cassava") != std::string::npos ||
                   lower.find("manioc") != std::string::npos) {
            recs.push_back("Check for cassava mosaic disease");
            recs.push_back("Use disease-resistant varieties for replanting");
        } else if (lower.find("banana") != std::string::npos ||
                   lower.find("plantain") != std::string::npos) {
            recs.push_back("Inspect for black sigatoka or Panama disease");
            recs.push_back("Apply systemic fungicide and improve drainage");
        }

        return recs;
    }
};