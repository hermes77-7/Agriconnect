#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "../utils/Password.h"
#include "AuthMiddleware.h"
#include <string>

using json = nlohmann::json;

inline void registerUserRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── PUT /api/user/profile ─────────────────────────────────
    // Update name and phone
    server.Put("/api/user/profile", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            auto body        = json::parse(req.body);
            std::string name = body.value("name", "");
            std::string phone = body.value("phone", "");

            if (name.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "Name is required"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr = std::to_string(payload.userId);
            std::string sql =
                "UPDATE users SET name = $1, phone = $2 WHERE id = $3 "
                "RETURNING id, name, email, phone, type";

            const char* params[3] = { name.c_str(), phone.c_str(), userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 3, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json updated = {
                {"id",    std::stoi(PQgetvalue(result, 0, 0))},
                {"name",  PQgetvalue(result, 0, 1)},
                {"email", PQgetvalue(result, 0, 2)},
                {"phone", PQgetvalue(result, 0, 3)},
                {"type",  PQgetvalue(result, 0, 4)}
            };
            PQclear(result);

            res.set_content(json{{"message", "Profile updated"}, {"user", updated}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/user/password ────────────────────────────────
    // Change password — requires current password
    server.Put("/api/user/password", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            auto body = json::parse(req.body);
            std::string currentPassword = body.value("currentPassword", "");
            std::string newPassword     = body.value("newPassword", "");

            if (currentPassword.empty() || newPassword.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "currentPassword and newPassword are required"}}.dump(), "application/json");
                return;
            }

            if (newPassword.length() < 6) {
                res.status = 400;
                res.set_content(json{{"error", "New password must be at least 6 characters"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Fetch current hash
            std::string userIdStr = std::to_string(payload.userId);
            std::string fetchSql = "SELECT password_hash FROM users WHERE id = $1";
            const char* fetchParams[1] = { userIdStr.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "User not found"}}.dump(), "application/json");
                return;
            }

            std::string currentHash = PQgetvalue(fetchRes, 0, 0);
            PQclear(fetchRes);

            // Verify current password
            if (!Password::verify(currentPassword, currentHash)) {
                res.status = 401;
                res.set_content(json{{"error", "Current password is incorrect"}}.dump(), "application/json");
                return;
            }

            // Hash new password
            std::string newHash = Password::hash(newPassword);
            std::string updateSql = "UPDATE users SET password_hash = $1 WHERE id = $2";
            const char* updateParams[2] = { newHash.c_str(), userIdStr.c_str() };
            PGresult* updateRes = PQexecParams(conn, updateSql.c_str(), 2, nullptr, updateParams, nullptr, nullptr, 0);

            if (PQresultStatus(updateRes) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(updateRes);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }
            PQclear(updateRes);

            res.set_content(json{{"message", "Password updated successfully"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/user/role ────────────────────────────────────
    // Wholesaler upgrades to Farmer or Transporter
    server.Put("/api/user/role", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "WHOLESALER") {
            res.status = 403;
            res.set_content(json{{"error", "Only wholesalers can upgrade their role"}}.dump(), "application/json");
            return;
        }

        try {
            auto body         = json::parse(req.body);
            std::string newRole = body.value("role", "");

            if (newRole != "FARMER" && newRole != "TRANSPORTER") {
                res.status = 400;
                res.set_content(json{{"error", "Role must be FARMER or TRANSPORTER"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr = std::to_string(payload.userId);
            std::string sql =
                "UPDATE users SET type = $1::user_type_enum WHERE id = $2 "
                "RETURNING id, name, email, type";

            const char* params[2] = { newRole.c_str(), userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 2, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json updated = {
                {"id",    std::stoi(PQgetvalue(result, 0, 0))},
                {"name",  PQgetvalue(result, 0, 1)},
                {"email", PQgetvalue(result, 0, 2)},
                {"type",  PQgetvalue(result, 0, 3)}
            };
            PQclear(result);

            res.set_content(json{
                {"message", "Role updated to " + newRole + ". Please log in again."},
                {"user",    updated}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/user/order-history ───────────────────────────
    // All completed/cancelled/rejected orders for the user
    server.Get("/api/user/order-history", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr = std::to_string(payload.userId);
            std::string sql =
                "SELECT o.id, o.listing_id, o.quantity_ordered, o.total_price, "
                "o.status, o.created_at, "
                "l.crop_name, l.category, l.pickup_location, l.region, "
                "u.name as farmer_name, u.phone as farmer_phone "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "JOIN users u ON l.user_id = u.id "
                "WHERE o.buyer_id = $1 "
                "AND o.status IN ('Completed', 'Cancelled', 'Rejected') "
                "ORDER BY o.created_at DESC";

            const char* params[1] = { userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json orders = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                orders.push_back({
                    {"id",              std::stoi(PQgetvalue(result, i, 0))},
                    {"listingId",       std::stoi(PQgetvalue(result, i, 1))},
                    {"quantityOrdered", std::stod(PQgetvalue(result, i, 2))},
                    {"totalPrice",      std::stod(PQgetvalue(result, i, 3))},
                    {"status",          PQgetvalue(result, i, 4)},
                    {"createdAt",       PQgetvalue(result, i, 5)},
                    {"listing", {
                        {"cropName",       PQgetvalue(result, i, 6)},
                        {"category",       PQgetvalue(result, i, 7)},
                        {"pickupLocation", PQgetvalue(result, i, 8)},
                        {"region",         PQgetvalue(result, i, 9)}
                    }},
                    {"farmer", {
                        {"name",  PQgetvalue(result, i, 10)},
                        {"phone", PQgetvalue(result, i, 11)}
                    }}
                });
            }
            PQclear(result);

            res.set_content(orders.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/user/delivery-history ───────────────────────
    // Transporter sees their completed deliveries
    server.Get("/api/user/delivery-history", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "TRANSPORTER") {
            res.status = 403;
            res.set_content(json{{"error", "Transporters only"}}.dump(), "application/json");
            return;
        }

        try {
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string userIdStr = std::to_string(payload.userId);
            std::string sql =
                "SELECT tj.id, tj.pickup_location, tj.destination, "
                "tj.cargo_desc, tj.transport_date, tj.estimated_weight, "
                "tj.price, tj.status, tj.created_at, "
                "l.crop_name, "
                "u.name as requester_name, u.phone as requester_phone "
                "FROM transport_jobs tj "
                "LEFT JOIN listings l ON tj.listing_id = l.id "
                "JOIN users u ON tj.requested_by = u.id "
                "WHERE tj.transporter_id = $1 "
                "AND tj.status = 'Delivered' "
                "ORDER BY tj.created_at DESC";

            const char* params[1] = { userIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", err}}.dump(), "application/json");
                return;
            }

            json jobs = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                jobs.push_back({
                    {"id",              std::stoi(PQgetvalue(result, i, 0))},
                    {"pickupLocation",  PQgetvalue(result, i, 1)},
                    {"destination",     PQgetvalue(result, i, 2)},
                    {"cargoDesc",       PQgetvalue(result, i, 3)},
                    {"transportDate",   PQgetisnull(result, i, 4) ? "" : PQgetvalue(result, i, 4)},
                    {"estimatedWeight", PQgetisnull(result, i, 5) ? 0.0 : std::stod(PQgetvalue(result, i, 5))},
                    {"price",           PQgetisnull(result, i, 6) ? 0.0 : std::stod(PQgetvalue(result, i, 6))},
                    {"status",          PQgetvalue(result, i, 7)},
                    {"createdAt",       PQgetvalue(result, i, 8)},
                    {"cropName",        PQgetisnull(result, i, 9) ? "" : PQgetvalue(result, i, 9)},
                    {"requestedBy", {
                        {"name",  PQgetvalue(result, i, 10)},
                        {"phone", PQgetvalue(result, i, 11)}
                    }}
                });
            }
            PQclear(result);

            res.set_content(jobs.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}