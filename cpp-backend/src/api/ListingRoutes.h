#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "AuthMiddleware.h"
#include <string>
#include <sstream>

using json = nlohmann::json;

inline void registerListingRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── GET /api/listings ─────────────────────────────────────
    // Public: browse all available listings with optional filters
    server.Get("/api/listings", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        try {
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Build dynamic query with filters
            std::string sql =
                "SELECT l.id, l.crop_name, l.category, l.total_quantity, l.available_qty, "
                "l.min_order_qty, l.price, l.pickup_location, l.region, l.description, "
                "l.image_url, l.status, l.created_at, "
                "u.id as farmer_id, u.name as farmer_name, u.phone as farmer_phone "
                "FROM listings l "
                "JOIN users u ON l.user_id = u.id "
                "WHERE l.status = 'Available' ";

            std::vector<std::string> paramValues;
            int paramIndex = 1;

            // Filter: crop name
            if (req.has_param("crop")) {
                sql += " AND LOWER(l.crop_name) LIKE LOWER($" + std::to_string(paramIndex++) + ")";
                paramValues.push_back("%" + req.get_param_value("crop") + "%");
            }

            // Filter: category
            if (req.has_param("category")) {
                sql += " AND l.category = $" + std::to_string(paramIndex++) + "::category_enum";
                paramValues.push_back(req.get_param_value("category"));
            }

            // Filter: region
            if (req.has_param("region")) {
                sql += " AND LOWER(l.region) LIKE LOWER($" + std::to_string(paramIndex++) + ")";
                paramValues.push_back("%" + req.get_param_value("region") + "%");
            }

            // Filter: min price
            if (req.has_param("minPrice")) {
                sql += " AND l.price >= $" + std::to_string(paramIndex++);
                paramValues.push_back(req.get_param_value("minPrice"));
            }

            // Filter: max price
            if (req.has_param("maxPrice")) {
                sql += " AND l.price <= $" + std::to_string(paramIndex++);
                paramValues.push_back(req.get_param_value("maxPrice"));
            }

            // Filter: min quantity
            if (req.has_param("minQty")) {
                sql += " AND l.available_qty >= $" + std::to_string(paramIndex++);
                paramValues.push_back(req.get_param_value("minQty"));
            }

            sql += " ORDER BY l.created_at DESC";

            // Build param arrays for PQexecParams
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

            json listings = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                listings.push_back({
                    {"id",             std::stoi(PQgetvalue(result, i, 0))},
                    {"cropName",       PQgetvalue(result, i, 1)},
                    {"category",       PQgetvalue(result, i, 2)},
                    {"totalQuantity",  std::stod(PQgetvalue(result, i, 3))},
                    {"availableQty",   std::stod(PQgetvalue(result, i, 4))},
                    {"minOrderQty",    std::stod(PQgetvalue(result, i, 5))},
                    {"price",          std::stod(PQgetvalue(result, i, 6))},
                    {"pickupLocation", PQgetvalue(result, i, 7)},
                    {"region",         PQgetvalue(result, i, 8)},
                    {"description",    PQgetvalue(result, i, 9)},
                    {"imageUrl",       PQgetvalue(result, i, 10)},
                    {"status",         PQgetvalue(result, i, 11)},
                    {"createdAt",      PQgetvalue(result, i, 12)},
                    {"farmer", {
                        {"id",    std::stoi(PQgetvalue(result, i, 13))},
                        {"name",  PQgetvalue(result, i, 14)},
                        {"phone", PQgetvalue(result, i, 15)}
                    }}
                });
            }
            PQclear(result);

            res.set_content(listings.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/listings/:id ─────────────────────────────────
    server.Get(R"(/api/listings/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        try {
            std::string listingId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql =
                "SELECT l.id, l.crop_name, l.category, l.total_quantity, l.available_qty, "
                "l.min_order_qty, l.price, l.pickup_location, l.region, l.description, "
                "l.image_url, l.status, l.created_at, "
                "u.id as farmer_id, u.name as farmer_name, u.phone as farmer_phone "
                "FROM listings l JOIN users u ON l.user_id = u.id "
                "WHERE l.id = $1";

            const char* params[1] = { listingId.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQntuples(result) == 0) {
                PQclear(result);
                res.status = 404;
                res.set_content(json{{"error", "Listing not found"}}.dump(), "application/json");
                return;
            }

            json listing = {
                {"id",             std::stoi(PQgetvalue(result, 0, 0))},
                {"cropName",       PQgetvalue(result, 0, 1)},
                {"category",       PQgetvalue(result, 0, 2)},
                {"totalQuantity",  std::stod(PQgetvalue(result, 0, 3))},
                {"availableQty",   std::stod(PQgetvalue(result, 0, 4))},
                {"minOrderQty",    std::stod(PQgetvalue(result, 0, 5))},
                {"price",          std::stod(PQgetvalue(result, 0, 6))},
                {"pickupLocation", PQgetvalue(result, 0, 7)},
                {"region",         PQgetvalue(result, 0, 8)},
                {"description",    PQgetvalue(result, 0, 9)},
                {"imageUrl",       PQgetvalue(result, 0, 10)},
                {"status",         PQgetvalue(result, 0, 11)},
                {"createdAt",      PQgetvalue(result, 0, 12)},
                {"farmer", {
                    {"id",    std::stoi(PQgetvalue(result, 0, 13))},
                    {"name",  PQgetvalue(result, 0, 14)},
                    {"phone", PQgetvalue(result, 0, 15)}
                }}
            };
            PQclear(result);

            res.set_content(listing.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── POST /api/listings ────────────────────────────────────
    // Farmers only: create a listing
server.Post("/api/listings", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
    JwtPayload payload;
    if (!requireAuth(req, res, jwtSecret, payload)) return;

    std::cout << "Auth passed. UserType: " << payload.userType << "\n";

    if (payload.userType != "FARMER") {
        res.status = 403;
        res.set_content(json{{"error", "Only farmers can create listings"}}.dump(), "application/json");
        return;
    }

    try {
        std::cout << "Body: " << req.body << "\n";
        auto body = json::parse(req.body);
        std::cout << "JSON parsed OK\n";

        std::string cropName       = body.value("cropName", "");
        std::string category       = body.value("category", "Other");
        std::string pickupLocation = body.value("pickupLocation", "");
        std::string region         = body.value("region", "");
        std::string description    = body.value("description", "");
        std::string imageUrl       = body.value("imageUrl", "");

        double totalQty    = body.value("totalQuantity", 0.0);
        double minOrderQty = body.value("minOrderQty", 1.0);
        double price       = body.value("price", 0.0);

        std::cout << "cropName: " << cropName << "\n";
        std::cout << "category: " << category << "\n";
        std::cout << "totalQty: " << totalQty << "\n";
        std::cout << "price: " << price << "\n";
        std::cout << "pickupLocation: " << pickupLocation << "\n";

        if (cropName.empty() || pickupLocation.empty()) {
            res.status = 400;
            res.set_content(json{{"error", "cropName and pickupLocation are required"}}.dump(), "application/json");
            return;
        }

            if (totalQty <= 0 || price <= 0) {
                res.status = 400;
                res.set_content(json{{"error", "totalQuantity and price must be greater than 0"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();
            std::string userId = std::to_string(payload.userId);
            std::string totalQtyStr    = std::to_string(totalQty);
            std::string minOrderQtyStr = std::to_string(minOrderQty);
            std::string priceStr       = std::to_string(price);

            std::string sql =
                "INSERT INTO listings "
                "(user_id, crop_name, category, total_quantity, available_qty, min_order_qty, "
                "price, pickup_location, region, description, image_url) "
                "VALUES ($1, $2, $3::category_enum, $4, $4, $5, $6, $7, $8, $9, $10) "
                "RETURNING id";

            const char* params[10] = {
                userId.c_str(), cropName.c_str(), category.c_str(),
                totalQtyStr.c_str(), minOrderQtyStr.c_str(), priceStr.c_str(),
                pickupLocation.c_str(), region.c_str(),
                description.c_str(), imageUrl.c_str()
            };

            PGresult* result = PQexecParams(conn, sql.c_str(), 10, nullptr, params, nullptr, nullptr, 0);

            if (PQresultStatus(result) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(result);
                res.status = 500;
                res.set_content(json{{"error", "Failed to create listing: " + err}}.dump(), "application/json");
                return;
            }

            int newId = std::stoi(PQgetvalue(result, 0, 0));
            PQclear(result);

            res.status = 201;
            res.set_content(json{
                {"message",   "Listing created successfully"},
                {"listingId", newId}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    }
);

    // ── PUT /api/listings/:id ─────────────────────────────────
    // Farmers only: update their own listing
    server.Put(R"(/api/listings/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Only farmers can update listings"}}.dump(), "application/json");
            return;
        }

        try {
            std::string listingId = req.matches[1];
            auto body = json::parse(req.body);
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Verify ownership
            std::string checkSql = "SELECT user_id FROM listings WHERE id = $1";
            const char* checkParams[1] = { listingId.c_str() };
            PGresult* checkRes = PQexecParams(conn, checkSql.c_str(), 1, nullptr, checkParams, nullptr, nullptr, 0);

            if (PQntuples(checkRes) == 0) {
                PQclear(checkRes);
                res.status = 404;
                res.set_content(json{{"error", "Listing not found"}}.dump(), "application/json");
                return;
            }

            int ownerId = std::stoi(PQgetvalue(checkRes, 0, 0));
            PQclear(checkRes);

            if (ownerId != payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You can only edit your own listings"}}.dump(), "application/json");
                return;
            }

            // Build update query dynamically
            std::vector<std::string> setClauses;
            std::vector<std::string> paramValues;
            int idx = 1;

            if (body.contains("cropName")) {
                setClauses.push_back("crop_name = $" + std::to_string(idx++));
                paramValues.push_back(body["cropName"].get<std::string>());
            }
            if (body.contains("category")) {
                setClauses.push_back("category = $" + std::to_string(idx++) + "::category_enum");
                paramValues.push_back(body["category"].get<std::string>());
            }
            if (body.contains("price")) {
                setClauses.push_back("price = $" + std::to_string(idx++));
                paramValues.push_back(std::to_string(body["price"].get<double>()));
            }
            if (body.contains("totalQuantity")) {
                setClauses.push_back("total_quantity = $" + std::to_string(idx++));
                paramValues.push_back(std::to_string(body["totalQuantity"].get<double>()));
            }
            if (body.contains("minOrderQty")) {
                setClauses.push_back("min_order_qty = $" + std::to_string(idx++));
                paramValues.push_back(std::to_string(body["minOrderQty"].get<double>()));
            }
            if (body.contains("pickupLocation")) {
                setClauses.push_back("pickup_location = $" + std::to_string(idx++));
                paramValues.push_back(body["pickupLocation"].get<std::string>());
            }
            if (body.contains("region")) {
                setClauses.push_back("region = $" + std::to_string(idx++));
                paramValues.push_back(body["region"].get<std::string>());
            }
            if (body.contains("description")) {
                setClauses.push_back("description = $" + std::to_string(idx++));
                paramValues.push_back(body["description"].get<std::string>());
            }
            if (body.contains("status")) {
                setClauses.push_back("status = $" + std::to_string(idx++) + "::listing_status_enum");
                paramValues.push_back(body["status"].get<std::string>());
            }

            if (setClauses.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "No fields to update"}}.dump(), "application/json");
                return;
            }

            // Add listing id as last param
            paramValues.push_back(listingId);
            std::string sql = "UPDATE listings SET ";
            for (size_t i = 0; i < setClauses.size(); i++) {
                sql += setClauses[i];
                if (i < setClauses.size() - 1) sql += ", ";
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

            res.set_content(json{{"message", "Listing updated successfully"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── DELETE /api/listings/:id ──────────────────────────────
    // Farmers only: delete their own listing (only if no active orders)
    server.Delete(R"(/api/listings/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Only farmers can delete listings"}}.dump(), "application/json");
            return;
        }

        try {
            std::string listingId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Verify ownership
            std::string checkSql = "SELECT user_id FROM listings WHERE id = $1";
            const char* checkParams[1] = { listingId.c_str() };
            PGresult* checkRes = PQexecParams(conn, checkSql.c_str(), 1, nullptr, checkParams, nullptr, nullptr, 0);

            if (PQntuples(checkRes) == 0) {
                PQclear(checkRes);
                res.status = 404;
                res.set_content(json{{"error", "Listing not found"}}.dump(), "application/json");
                return;
            }

            int ownerId = std::stoi(PQgetvalue(checkRes, 0, 0));
            PQclear(checkRes);

            if (ownerId != payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You can only delete your own listings"}}.dump(), "application/json");
                return;
            }

            // Block deletion if active orders exist
            std::string orderCheckSql =
                "SELECT id FROM orders WHERE listing_id = $1 "
                "AND status IN ('Pending', 'Accepted')";
            const char* orderParams[1] = { listingId.c_str() };
            PGresult* orderCheck = PQexecParams(conn, orderCheckSql.c_str(), 1, nullptr, orderParams, nullptr, nullptr, 0);

            if (PQntuples(orderCheck) > 0) {
                PQclear(orderCheck);
                res.status = 409;
                res.set_content(json{{"error", "Cannot delete listing with active orders"}}.dump(), "application/json");
                return;
            }
            PQclear(orderCheck);

            std::string deleteSql = "DELETE FROM listings WHERE id = $1";
            PGresult* deleteRes = PQexecParams(conn, deleteSql.c_str(), 1, nullptr, checkParams, nullptr, nullptr, 0);

            if (PQresultStatus(deleteRes) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(deleteRes);
                res.status = 500;
                res.set_content(json{{"error", "Delete failed: " + err}}.dump(), "application/json");
                return;
            }
            PQclear(deleteRes);

            res.set_content(json{{"message", "Listing deleted successfully"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/farmers/listings ─────────────────────────────
    // Farmers only: get their own listings
    server.Get("/api/farmer/listings", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
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
            std::string userId = std::to_string(payload.userId);

            std::string sql =
                "SELECT id, crop_name, category, total_quantity, available_qty, "
                "min_order_qty, price, pickup_location, region, description, "
                "image_url, status, created_at "
                "FROM listings WHERE user_id = $1 ORDER BY created_at DESC";

            const char* params[1] = { userId.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            json listings = json::array();
            int rows = PQntuples(result);
            for (int i = 0; i < rows; i++) {
                listings.push_back({
                    {"id",             std::stoi(PQgetvalue(result, i, 0))},
                    {"cropName",       PQgetvalue(result, i, 1)},
                    {"category",       PQgetvalue(result, i, 2)},
                    {"totalQuantity",  std::stod(PQgetvalue(result, i, 3))},
                    {"availableQty",   std::stod(PQgetvalue(result, i, 4))},
                    {"minOrderQty",    std::stod(PQgetvalue(result, i, 5))},
                    {"price",          std::stod(PQgetvalue(result, i, 6))},
                    {"pickupLocation", PQgetvalue(result, i, 7)},
                    {"region",         PQgetvalue(result, i, 8)},
                    {"description",    PQgetvalue(result, i, 9)},
                    {"imageUrl",       PQgetvalue(result, i, 10)},
                    {"status",         PQgetvalue(result, i, 11)},
                    {"createdAt",      PQgetvalue(result, i, 12)}
                });
            }
            PQclear(result);

            res.set_content(listings.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}