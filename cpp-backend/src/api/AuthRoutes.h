#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "../utils/Password.h"
#include "../utils/JwtUtil.h"
#include <string>

using json = nlohmann::json;

inline void registerAuthRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── POST /api/auth/register ──────────────────────────────
    server.Post("/api/auth/register", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);

            std::string name     = body.value("name", "");
            std::string email    = body.value("email", "");
            std::string phone    = body.value("phone", "");
            std::string password = body.value("password", "");
            std::string userType = body.value("type", "");

            // Validate required fields
            if (name.empty() || email.empty() || password.empty() || userType.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "name, email, password and type are required"}}.dump(), "application/json");
                return;
            }

            // Validate user type
            if (userType != "FARMER" && userType != "WHOLESALER" && userType != "TRANSPORTER") {
                res.status = 400;
                res.set_content(json{{"error", "type must be FARMER, WHOLESALER or TRANSPORTER"}}.dump(), "application/json");
                return;
            }

            PGconn* conn = Database::getInstance().getConnection();

            // Check email uniqueness
            std::string checkSql = "SELECT id FROM users WHERE email = $1";
            const char* checkParams[1] = { email.c_str() };
            PGresult* checkRes = PQexecParams(conn, checkSql.c_str(), 1, nullptr, checkParams, nullptr, nullptr, 0);

            if (PQntuples(checkRes) > 0) {
                PQclear(checkRes);
                res.status = 409;
                res.set_content(json{{"error", "Email already registered"}}.dump(), "application/json");
                return;
            }
            PQclear(checkRes);

            // Hash password
            std::string hashed = Password::hash(password);

            // Insert user
            std::string insertSql =
                "INSERT INTO users (name, email, phone, password_hash, type) "
                "VALUES ($1, $2, $3, $4, $5::user_type_enum) RETURNING id";

            const char* params[5] = {
                name.c_str(), email.c_str(), phone.c_str(),
                hashed.c_str(), userType.c_str()
            };

            PGresult* insertRes = PQexecParams(conn, insertSql.c_str(), 5, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(insertRes) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(insertRes);
                res.status = 500;
                res.set_content(json{{"error", "Registration failed: " + err}}.dump(), "application/json");
                return;
            }

            int newId = std::stoi(PQgetvalue(insertRes, 0, 0));
            PQclear(insertRes);

            // Generate JWT
            JwtPayload payload{newId, email, userType};
            std::string token = JwtUtil::generate(payload, jwtSecret);

            res.status = 201;
            res.set_content(json{
                {"message", "Registration successful"},
                {"token",   token},
                {"user", {
                    {"id",    newId},
                    {"name",  name},
                    {"email", email},
                    {"type",  userType}
                }}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── POST /api/auth/login ─────────────────────────────────
    server.Post("/api/auth/login", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = json::parse(req.body);

            std::string email    = body.value("email", "");
            std::string password = body.value("password", "");

            if (email.empty() || password.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "email and password are required"}}.dump(), "application/json");
                return;
            }

            PGconn* conn = Database::getInstance().getConnection();

            std::string sql =
                "SELECT id, name, password_hash, type FROM users WHERE email = $1 AND is_active = true";
            const char* params[1] = { email.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQntuples(result) == 0) {
                PQclear(result);
                res.status = 401;
                res.set_content(json{{"error", "Invalid credentials"}}.dump(), "application/json");
                return;
            }

            int         userId   = std::stoi(PQgetvalue(result, 0, 0));
            std::string name     = PQgetvalue(result, 0, 1);
            std::string hashStr  = PQgetvalue(result, 0, 2);
            std::string userType = PQgetvalue(result, 0, 3);
            PQclear(result);

            if (!Password::verify(password, hashStr)) {
                res.status = 401;
                res.set_content(json{{"error", "Invalid credentials"}}.dump(), "application/json");
                return;
            }

            JwtPayload payload{userId, email, userType};
            std::string token = JwtUtil::generate(payload, jwtSecret);

            res.status = 200;
            res.set_content(json{
                {"token", token},
                {"user", {
                    {"id",    userId},
                    {"name",  name},
                    {"email", email},
                    {"type",  userType}
                }}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}