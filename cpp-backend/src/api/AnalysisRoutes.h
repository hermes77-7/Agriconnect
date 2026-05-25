#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "../analysis/AnalysisEngine.h"
#include "AuthMiddleware.h"
#include <string>
#include <fstream>
#include <filesystem>
#include <chrono>
#include <sstream>
#include <iomanip>

using json = nlohmann::json;
namespace fs = std::filesystem;

// Generate a unique filename based on timestamp + user id
inline std::string generateFilename(int userId, const std::string& ext) {
    auto now = std::chrono::system_clock::now();
    auto ms  = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
    return "crop_" + std::to_string(userId) + "_" + std::to_string(ms) + ext;
}

inline void registerAnalysisRoutes(httplib::Server& server,
                                    const std::string& jwtSecret,
                                    const std::string& uploadDir) {

    // Ensure upload directory exists
    fs::create_directories(uploadDir);

    // ── POST /api/analysis ────────────────────────────────────
    // Farmers only: upload crop image for analysis
    server.Post("/api/analysis", [jwtSecret, uploadDir](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Only farmers can submit crop analyses"}}.dump(), "application/json");
            return;
        }

        try {
            // Get multipart file
            auto imageFile = req.get_file_value("image");
            if (imageFile.content.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "No image file provided. Use field name 'image'"}}.dump(), "application/json");
                return;
            }

            // Validate file type
            std::string contentType = imageFile.content_type;
            if (contentType != "image/jpeg" &&
                contentType != "image/jpg"  &&
                contentType != "image/png") {
                res.status = 400;
                res.set_content(json{{"error", "Only JPEG and PNG images are accepted"}}.dump(), "application/json");
                return;
            }

            // Validate file size (max 10MB)
            if (imageFile.content.size() > 10 * 1024 * 1024) {
                res.status = 400;
                res.set_content(json{{"error", "Image must be under 10MB"}}.dump(), "application/json");
                return;
            }

            // Get crop name from form
            std::string cropName = "Unknown";
            if (req.has_file("cropName")) {
                cropName = req.get_file_value("cropName").content;
            } else if (req.has_param("cropName")) {
                cropName = req.get_param_value("cropName");
            }

            // Determine file extension
            std::string ext = (contentType == "image/png") ? ".png" : ".jpg";
            std::string filename = generateFilename(payload.userId, ext);
            std::string fullPath = uploadDir + "/" + filename;

            // Save image to disk
            std::ofstream outFile(fullPath, std::ios::binary);
            if (!outFile.is_open()) {
                res.status = 500;
                res.set_content(json{{"error", "Failed to save image"}}.dump(), "application/json");
                return;
            }
            outFile.write(imageFile.content.data(), imageFile.content.size());
            outFile.close();

            // Run analysis engine
            AnalysisResult analysis = AnalysisEngine::analyze(
                fullPath, cropName, imageFile.content.size()
            );

            // Serialize recommendations to JSON string for storage
            json recsJson = analysis.recommendations;
            std::string recsStr = recsJson.dump();

            // Save result to database
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr     = std::to_string(payload.userId);
            std::string confidenceStr = std::to_string(analysis.confidence);

            std::string insertSql =
                "INSERT INTO crop_analyses "
                "(user_id, image_path, crop_name, result, confidence, recommendations) "
                "VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, analyzed_at";

            const char* params[6] = {
                userIdStr.c_str(),
                filename.c_str(),
                cropName.c_str(),
                analysis.result.c_str(),
                confidenceStr.c_str(),
                recsStr.c_str()
            };

            PGresult* insertRes = PQexecParams(
                conn, insertSql.c_str(), 6,
                nullptr, params, nullptr, nullptr, 0
            );

            if (PQresultStatus(insertRes) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(insertRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to save analysis: " + err}}.dump(), "application/json");
                return;
            }

            int analysisId       = std::stoi(PQgetvalue(insertRes, 0, 0));
            std::string analyzedAt = PQgetvalue(insertRes, 0, 1);
            PQclear(insertRes);

            // Build response
            json response = {
                {"status",          "success"},
                {"analysisId",      analysisId},
                {"cropName",        cropName},
                {"result",          analysis.result},
                {"confidence",      analysis.confidence},
                {"recommendations", analysis.recommendations},
                {"analyzedAt",      analyzedAt},
                {"imagePath",       filename}
            };

            res.status = 201;
            res.set_content(response.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/analysis ─────────────────────────────────────
    // Farmers only: get their analysis history
    server.Get("/api/analysis", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Farmers only"}}.dump(), "application/json");
            return;
        }

        try {
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr = std::to_string(payload.userId);
            std::string sql =
                "SELECT id, crop_name, result, confidence, "
                "recommendations, image_path, analyzed_at "
                "FROM crop_analyses WHERE user_id = $1 "
                "ORDER BY analyzed_at DESC";

            const char* params[1] = { userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json analyses = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                // Parse recommendations from stored JSON string
                json recs = json::array();
                try {
                    std::string recsStr = PQgetvalue(result, i, 4);
                    if (!recsStr.empty()) recs = json::parse(recsStr);
                } catch (...) {}

                analyses.push_back({
                    {"id",              std::stoi(PQgetvalue(result, i, 0))},
                    {"cropName",        PQgetvalue(result, i, 1)},
                    {"result",          PQgetvalue(result, i, 2)},
                    {"confidence",      std::stof(PQgetvalue(result, i, 3))},
                    {"recommendations", recs},
                    {"imagePath",       PQgetvalue(result, i, 5)},
                    {"analyzedAt",      PQgetvalue(result, i, 6)}
                });
            }
            PQclear(result);

            res.set_content(analyses.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/analysis/:id ─────────────────────────────────
    // Get a single analysis result
    server.Get(R"(/api/analysis/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            std::string analysisId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql =
                "SELECT id, crop_name, result, confidence, "
                "recommendations, image_path, analyzed_at "
                "FROM crop_analyses WHERE id = $1 AND user_id = $2";

            std::string userIdStr = std::to_string(payload.userId);
            const char* params[2] = { analysisId.c_str(), userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 2, nullptr, params, nullptr, nullptr, 0);

            if (PQntuples(result) == 0) {
                PQclear(result);
                res.status = 404;
                res.set_content(json{{"error", "Analysis not found"}}.dump(), "application/json");
                return;
            }

            json recs = json::array();
            try {
                std::string recsStr = PQgetvalue(result, 0, 4);
                if (!recsStr.empty()) recs = json::parse(recsStr);
            } catch (...) {}

            json analysis = {
                {"id",              std::stoi(PQgetvalue(result, 0, 0))},
                {"cropName",        PQgetvalue(result, 0, 1)},
                {"result",          PQgetvalue(result, 0, 2)},
                {"confidence",      std::stof(PQgetvalue(result, 0, 3))},
                {"recommendations", recs},
                {"imagePath",       PQgetvalue(result, 0, 5)},
                {"analyzedAt",      PQgetvalue(result, 0, 6)}
            };
            PQclear(result);

            res.set_content(analysis.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── DELETE /api/analysis ─────────────────────────────────
server.Delete("/api/analysis", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
    JwtPayload payload;
    if (!requireAuth(req, res, jwtSecret, payload)) return;

    if (payload.userType != "FARMER") {
        res.status = 403;
        res.set_content(json{{"error", "Farmers only"}}.dump(), "application/json");
        return;
    }

    try {
        ScopedConn scoped(Database::getInstance().getConnectionString());
        PGconn* conn = scoped.get();

        std::string userIdStr = std::to_string(payload.userId);
        std::string sql = "DELETE FROM crop_analyses WHERE user_id = $1";
        const char* params[1] = { userIdStr.c_str() };
        PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

        if (PQresultStatus(result) != PGRES_COMMAND_OK) {
            std::string err = PQerrorMessage(conn);
            PQclear(result);
            res.status = 500;
            res.set_content(json{{"error", err}}.dump(), "application/json");
            return;
        }

        int deleted = std::stoi(PQcmdTuples(result));
        PQclear(result);

        res.set_content(json{
            {"message", "History cleared"},
            {"deleted", deleted}
        }.dump(), "application/json");

    } catch (const std::exception& e) {
        res.status = 500;
        res.set_content(json{{"error", e.what()}}.dump(), "application/json");
    }
});

    // ── GET /api/uploads/:filename ────────────────────────────
    // Serve uploaded images
    server.Get(R"(/api/uploads/(.+))", [uploadDir](const httplib::Request& req, httplib::Response& res) {
        std::string filename = req.matches[1];

        // Basic security — prevent path traversal
        if (filename.find("..") != std::string::npos ||
            filename.find("/")  != std::string::npos ||
            filename.find("\\") != std::string::npos) {
            res.status = 400;
            res.set_content("Invalid filename", "text/plain");
            return;
        }

        std::string fullPath = uploadDir + "/" + filename;
        std::ifstream file(fullPath, std::ios::binary);

        if (!file.is_open()) {
            res.status = 404;
            res.set_content("Image not found", "text/plain");
            return;
        }

        std::string content((std::istreambuf_iterator<char>(file)),
                             std::istreambuf_iterator<char>());

        std::string contentType = "image/jpeg";
        if (filename.size() >= 4 &&
            filename.substr(filename.size() - 4) == ".png") {
            contentType = "image/png";
        }

        res.set_content(content, contentType);
    });
}