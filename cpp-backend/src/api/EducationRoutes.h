#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "AuthMiddleware.h"
#include <string>

using json = nlohmann::json;

inline void registerEducationRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── GET /api/education ────────────────────────────────────
    // All authenticated users: browse published articles
    server.Get("/api/education", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql =
                "SELECT a.id, a.title, a.category, a.cover_image, a.sections, "
                "a.created_at, a.updated_at, "
                "u.id as author_id, u.name as author_name "
                "FROM education_articles a "
                "LEFT JOIN users u ON a.author_id = u.id "
                "WHERE a.is_published = true ";

            std::vector<std::string> paramValues;
            int paramIndex = 1;

            if (req.has_param("category")) {
                sql += " AND a.category = $" + std::to_string(paramIndex++) +
                       "::education_category_enum";
                paramValues.push_back(req.get_param_value("category"));
            }

            if (req.has_param("search")) {
                sql += " AND LOWER(a.title) LIKE LOWER($" + std::to_string(paramIndex++) + ")";
                paramValues.push_back("%" + req.get_param_value("search") + "%");
            }

            sql += " ORDER BY a.created_at DESC";

            std::vector<const char*> params;
            for (auto& v : paramValues) params.push_back(v.c_str());

            PGresult* result = PQexecParams(
                conn, sql.c_str(), (int)params.size(),
                nullptr, params.empty() ? nullptr : params.data(),
                nullptr, nullptr, 0
            );

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json articles = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                // Parse sections JSONB
                json sections = json::array();
                try {
                    std::string sectionsStr = PQgetvalue(result, i, 4);
                    if (!sectionsStr.empty() && sectionsStr != "null") {
                        sections = json::parse(sectionsStr);
                    }
                } catch (...) {}

                articles.push_back({
                    {"id",         std::stoi(PQgetvalue(result, i, 0))},
                    {"title",      PQgetvalue(result, i, 1)},
                    {"category",   PQgetvalue(result, i, 2)},
                    {"coverImage", PQgetisnull(result, i, 3) ? "" : PQgetvalue(result, i, 3)},
                    {"sections",   sections},
                    {"createdAt",  PQgetvalue(result, i, 5)},
                    {"updatedAt",  PQgetvalue(result, i, 6)},
                    {"author", {
                        {"id",   PQgetisnull(result, i, 7) ? 0 : std::stoi(PQgetvalue(result, i, 7))},
                        {"name", PQgetisnull(result, i, 8) ? "Admin" : PQgetvalue(result, i, 8)}
                    }}
                });
            }
            PQclear(result);

            res.set_content(articles.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/education/:id ────────────────────────────────
    server.Get(R"(/api/education/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            std::string articleId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql =
                "SELECT a.id, a.title, a.category, a.cover_image, a.sections, "
                "a.created_at, a.updated_at, "
                "u.id as author_id, u.name as author_name "
                "FROM education_articles a "
                "LEFT JOIN users u ON a.author_id = u.id "
                "WHERE a.id = $1 AND a.is_published = true";

            const char* params[1] = { articleId.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQntuples(result) == 0) {
                PQclear(result);
                res.status = 404;
                res.set_content(json{{"error", "Article not found"}}.dump(), "application/json");
                return;
            }

            json sections = json::array();
            try {
                std::string sectionsStr = PQgetvalue(result, 0, 4);
                if (!sectionsStr.empty() && sectionsStr != "null") {
                    sections = json::parse(sectionsStr);
                }
            } catch (...) {}

            json article = {
                {"id",         std::stoi(PQgetvalue(result, 0, 0))},
                {"title",      PQgetvalue(result, 0, 1)},
                {"category",   PQgetvalue(result, 0, 2)},
                {"coverImage", PQgetisnull(result, 0, 3) ? "" : PQgetvalue(result, 0, 3)},
                {"sections",   sections},
                {"createdAt",  PQgetvalue(result, 0, 5)},
                {"updatedAt",  PQgetvalue(result, 0, 6)},
                {"author", {
                    {"id",   PQgetisnull(result, 0, 7) ? 0 : std::stoi(PQgetvalue(result, 0, 7))},
                    {"name", PQgetisnull(result, 0, 8) ? "Admin" : PQgetvalue(result, 0, 8)}
                }}
            };
            PQclear(result);

            res.set_content(article.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── POST /api/education ───────────────────────────────────
    // Admin only: create an article
    server.Post("/api/education", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "ADMIN") {
            res.status = 403;
            res.set_content(json{{"error", "Admin only"}}.dump(), "application/json");
            return;
        }

        try {
            auto body = json::parse(req.body);

            std::string title    = body.value("title", "");
            std::string category = body.value("category", "Other");
            std::string coverImg = body.value("coverImage", "");
            bool isPublished     = body.value("isPublished", true);

            if (title.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "title is required"}}.dump(), "application/json");
                return;
            }

            // sections is a JSON array of {heading, body} objects
            json sections = body.value("sections", json::array());
            std::string sectionsStr = sections.dump();

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string authorIdStr  = std::to_string(payload.userId);
            std::string publishedStr = isPublished ? "true" : "false";

            std::string sql =
                "INSERT INTO education_articles "
                "(author_id, title, category, cover_image, sections, is_published) "
                "VALUES ($1, $2, $3::education_category_enum, $4, $5::jsonb, $6) "
                "RETURNING id";

            const char* params[6] = {
                authorIdStr.c_str(), title.c_str(), category.c_str(),
                coverImg.empty() ? nullptr : coverImg.c_str(),
                sectionsStr.c_str(), publishedStr.c_str()
            };

            PGresult* result = PQexecParams(conn, sql.c_str(), 6, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", "Failed to create article: " + err}}.dump(), "application/json");
                return;
            }

            int newId = std::stoi(PQgetvalue(result, 0, 0));
            PQclear(result);

            res.status = 201;
            res.set_content(json{
                {"message",   "Article created"},
                {"articleId", newId}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/education/:id ────────────────────────────────
    // Admin only: update an article
    server.Put(R"(/api/education/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "ADMIN") {
            res.status = 403;
            res.set_content(json{{"error", "Admin only"}}.dump(), "application/json");
            return;
        }

        try {
            std::string articleId = req.matches[1];
            auto body = json::parse(req.body);

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::vector<std::string> setClauses;
            std::vector<std::string> paramValues;
            int idx = 1;

            if (body.contains("title")) {
                setClauses.push_back("title = $" + std::to_string(idx++));
                paramValues.push_back(body["title"].get<std::string>());
            }
            if (body.contains("category")) {
                setClauses.push_back("category = $" + std::to_string(idx++) + "::education_category_enum");
                paramValues.push_back(body["category"].get<std::string>());
            }
            if (body.contains("coverImage")) {
                setClauses.push_back("cover_image = $" + std::to_string(idx++));
                paramValues.push_back(body["coverImage"].get<std::string>());
            }
            if (body.contains("sections")) {
                setClauses.push_back("sections = $" + std::to_string(idx++) + "::jsonb");
                paramValues.push_back(body["sections"].dump());
            }
            if (body.contains("isPublished")) {
                setClauses.push_back("is_published = $" + std::to_string(idx++));
                paramValues.push_back(body["isPublished"].get<bool>() ? "true" : "false");
            }

            if (setClauses.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "No fields to update"}}.dump(), "application/json");
                return;
            }

            setClauses.push_back("updated_at = NOW()");
            paramValues.push_back(articleId);

            std::string sql = "UPDATE education_articles SET ";
            for (size_t i = 0; i < setClauses.size() - 1; i++) {
                sql += setClauses[i];
                if (i < setClauses.size() - 2) sql += ", ";
            }
            sql += ", " + setClauses.back();
            sql = "UPDATE education_articles SET ";
            for (size_t i = 0; i < setClauses.size(); i++) {
                if (i < setClauses.size() - 1) {
                    sql += setClauses[i];
                    if (i < setClauses.size() - 2) sql += ", ";
                }
            }
            sql += " WHERE id = $" + std::to_string(idx);

            std::vector<const char*> params;
            for (auto& v : paramValues) params.push_back(v.c_str());

            PGresult* result = PQexecParams(
                conn, sql.c_str(), (int)params.size(),
                nullptr, params.data(), nullptr, nullptr, 0
            );

            if (PQresultStatus(result) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", "Update failed: " + err}}.dump(), "application/json");
                return;
            }
            PQclear(result);

            res.set_content(json{{"message", "Article updated"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── DELETE /api/education/:id ─────────────────────────────
    // Admin only: delete an article
    server.Delete(R"(/api/education/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "ADMIN") {
            res.status = 403;
            res.set_content(json{{"error", "Admin only"}}.dump(), "application/json");
            return;
        }

        try {
            std::string articleId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql = "DELETE FROM education_articles WHERE id = $1";
            const char* params[1] = { articleId.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", "Delete failed: " + err}}.dump(), "application/json");
                return;
            }
            PQclear(result);

            res.set_content(json{{"message", "Article deleted"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}