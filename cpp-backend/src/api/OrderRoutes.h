#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "AuthMiddleware.h"
#include <string>

using json = nlohmann::json;

inline void registerOrderRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── POST /api/orders ──────────────────────────────────────
    // Any authenticated user except the listing owner can place an order
    server.Post("/api/orders", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            auto body       = json::parse(req.body);
            int listingId   = body.value("listingId", 0);
            double qtyOrdered = body.value("quantityOrdered", 0.0);

            if (listingId <= 0 || qtyOrdered <= 0) {
                res.status = 400;
                res.set_content(json{{"error", "listingId and quantityOrdered are required"}}.dump(), "application/json");
                return;
            }

            PGconn* conn = Database::getInstance().getConnection();
            std::string listingIdStr = std::to_string(listingId);

            // Fetch listing — no FOR UPDATE since we don't deduct yet
            std::string fetchSql =
                "SELECT total_quantity, available_qty, min_order_qty, price, status, user_id "
                "FROM listings WHERE id = $1";
            const char* fetchParams[1] = { listingIdStr.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Listing not found"}}.dump(), "application/json");
                return;
            }

            double totalQty    = std::stod(PQgetvalue(fetchRes, 0, 0));
            double availableQty = std::stod(PQgetvalue(fetchRes, 0, 1));
            double minOrderQty  = std::stod(PQgetvalue(fetchRes, 0, 2));
            double price        = std::stod(PQgetvalue(fetchRes, 0, 3));
            std::string status  = PQgetvalue(fetchRes, 0, 4);
            int farmerId        = std::stoi(PQgetvalue(fetchRes, 0, 5));
            PQclear(fetchRes);

            if (farmerId == payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You cannot order your own listing"}}.dump(), "application/json");
                return;
            }

            if (status != "Available") {
                res.status = 409;
                res.set_content(json{{"error", "Listing is no longer available"}}.dump(), "application/json");
                return;
            }

            if (qtyOrdered < minOrderQty) {
                res.status = 400;
                res.set_content(json{{"error", "Minimum order is " + std::to_string(minOrderQty) + " kg"}}.dump(), "application/json");
                return;
            }

            // Check against total quantity not available_qty
            // since other pending orders haven't deducted yet
            if (qtyOrdered > totalQty) {
                res.status = 400;
                res.set_content(json{{"error", "Quantity exceeds total listing stock of " + std::to_string(totalQty) + " kg"}}.dump(), "application/json");
                return;
            }

            // Create order — no quantity deduction yet
            double totalPrice       = qtyOrdered * price;
            std::string buyerIdStr  = std::to_string(payload.userId);
            std::string qtyStr      = std::to_string(qtyOrdered);
            std::string priceStr    = std::to_string(totalPrice);

            std::string orderSql =
                "INSERT INTO orders (listing_id, buyer_id, quantity_ordered, total_price) "
                "VALUES ($1, $2, $3, $4) RETURNING id";
            const char* orderParams[4] = {
                listingIdStr.c_str(), buyerIdStr.c_str(),
                qtyStr.c_str(), priceStr.c_str()
            };
            PGresult* orderRes = PQexecParams(conn, orderSql.c_str(), 4, nullptr, orderParams, nullptr, nullptr, 0);

            if (PQresultStatus(orderRes) != PGRES_TUPLES_OK) {
                PQclear(orderRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to create order"}}.dump(), "application/json");
                return;
            }

            int orderId = std::stoi(PQgetvalue(orderRes, 0, 0));
            PQclear(orderRes);

            res.status = 201;
            res.set_content(json{
                {"message",         "Order placed successfully. Awaiting farmer confirmation."},
                {"orderId",         orderId},
                {"quantityOrdered", qtyOrdered},
                {"totalPrice",      totalPrice}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/orders/my ────────────────────────────────────
    // Buyer sees their own placed orders
    server.Get("/api/orders/my", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            PGconn* conn = Database::getInstance().getConnection();
            std::string buyerIdStr = std::to_string(payload.userId);

            std::string sql =
                "SELECT o.id, o.listing_id, o.quantity_ordered, o.total_price, "
                "o.status, o.created_at, "
                "l.crop_name, l.category, l.price, l.pickup_location, l.region, l.image_url, "
                "u.id as farmer_id, u.name as farmer_name, u.phone as farmer_phone "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "JOIN users u ON l.user_id = u.id "
                "WHERE o.buyer_id = $1 "
                "ORDER BY o.created_at DESC";

            const char* params[1] = { buyerIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

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
                        {"pricePerKg",     std::stod(PQgetvalue(result, i, 8))},
                        {"pickupLocation", PQgetvalue(result, i, 9)},
                        {"region",         PQgetvalue(result, i, 10)},
                        {"imageUrl",       PQgetvalue(result, i, 11)}
                    }},
                    {"farmer", {
                        {"id",    std::stoi(PQgetvalue(result, i, 12))},
                        {"name",  PQgetvalue(result, i, 13)},
                        {"phone", PQgetvalue(result, i, 14)}
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

    // ── GET /api/orders/incoming ──────────────────────────────
    // Farmer sees orders placed on their listings
    server.Get("/api/orders/incoming", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Farmers only"}}.dump(), "application/json");
            return;
        }

        try {
            PGconn* conn = Database::getInstance().getConnection();
            std::string farmerIdStr = std::to_string(payload.userId);

            std::string sql =
                "SELECT o.id, o.listing_id, o.quantity_ordered, o.total_price, "
                "o.status, o.created_at, "
                "l.crop_name, l.category, l.image_url, l.pickup_location, "
                "u.id as buyer_id, u.name as buyer_name, u.phone as buyer_phone, u.type as buyer_type "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "JOIN users u ON o.buyer_id = u.id "
                "WHERE l.user_id = $1 "
                "ORDER BY o.created_at DESC";

            const char* params[1] = { farmerIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

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
                        {"imageUrl",       PQgetvalue(result, i, 8)},
                        {"pickupLocation", PQgetvalue(result, i, 9)}
                    }},
                    {"buyer", {
                        {"id",    std::stoi(PQgetvalue(result, i, 10))},
                        {"name",  PQgetvalue(result, i, 11)},
                        {"phone", PQgetvalue(result, i, 12)},
                        {"type",  PQgetvalue(result, i, 13)}
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

    // ── GET /api/orders/pending-count ─────────────────────────
    // Farmer gets count of pending incoming orders (for red dot)
    server.Get("/api/orders/pending-count", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.set_content(json{{"count", 0}}.dump(), "application/json");
            return;
        }

        try {
            PGconn* conn = Database::getInstance().getConnection();
            std::string farmerIdStr = std::to_string(payload.userId);

            std::string sql =
                "SELECT COUNT(*) FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "WHERE l.user_id = $1 AND o.status = 'Pending'";

            const char* params[1] = { farmerIdStr.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            int count = std::stoi(PQgetvalue(result, 0, 0));
            PQclear(result);

            res.set_content(json{{"count", count}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/orders/:id/accept ────────────────────────────
    // Farmer accepts an order — quantity deducted here
    server.Put(R"(/api/orders/(\d+)/accept)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Only farmers can accept orders"}}.dump(), "application/json");
            return;
        }

        try {
            std::string orderId = req.matches[1];
            PGconn* conn = Database::getInstance().getConnection();

            // Fetch order with listing info
            std::string fetchSql =
                "SELECT o.listing_id, o.quantity_ordered, o.status, "
                "l.user_id as farmer_id, l.available_qty "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "WHERE o.id = $1";
            const char* fetchParams[1] = { orderId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Order not found"}}.dump(), "application/json");
                return;
            }

            int listingId      = std::stoi(PQgetvalue(fetchRes, 0, 0));
            double qtyOrdered  = std::stod(PQgetvalue(fetchRes, 0, 1));
            std::string status = PQgetvalue(fetchRes, 0, 2);
            int farmerId       = std::stoi(PQgetvalue(fetchRes, 0, 3));
            double availableQty = std::stod(PQgetvalue(fetchRes, 0, 4));
            PQclear(fetchRes);

            if (farmerId != payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You can only accept orders on your own listings"}}.dump(), "application/json");
                return;
            }

            if (status != "Pending") {
                res.status = 409;
                res.set_content(json{{"error", "Only pending orders can be accepted"}}.dump(), "application/json");
                return;
            }

            if (qtyOrdered > availableQty) {
                res.status = 409;
                res.set_content(json{{"error", "Not enough quantity available. Available: " + std::to_string(availableQty) + " kg"}}.dump(), "application/json");
                return;
            }

            PQexec(conn, "BEGIN");

            // Accept the order
            std::string acceptSql = "UPDATE orders SET status = 'Accepted' WHERE id = $1";
            const char* acceptParams[1] = { orderId.c_str() };
            PGresult* acceptRes = PQexecParams(conn, acceptSql.c_str(), 1, nullptr, acceptParams, nullptr, nullptr, 0);

            if (PQresultStatus(acceptRes) != PGRES_COMMAND_OK) {
                PQclear(acceptRes);
                PQexec(conn, "ROLLBACK");
                res.status = 500;
                res.set_content(json{{"error", "Failed to accept order"}}.dump(), "application/json");
                return;
            }
            PQclear(acceptRes);

            // NOW deduct quantity from listing
            double newQty = availableQty - qtyOrdered;
            std::string newQtyStr    = std::to_string(newQty);
            std::string listingIdStr = std::to_string(listingId);

            std::string updateSql =
                "UPDATE listings SET available_qty = $1, "
                "status = CASE WHEN $1::float <= 0 THEN 'Sold'::listing_status_enum "
                "ELSE 'Available'::listing_status_enum END "
                "WHERE id = $2";
            const char* updateParams[2] = { newQtyStr.c_str(), listingIdStr.c_str() };
            PGresult* updateRes = PQexecParams(conn, updateSql.c_str(), 2, nullptr, updateParams, nullptr, nullptr, 0);

            if (PQresultStatus(updateRes) != PGRES_COMMAND_OK) {
                PQclear(updateRes);
                PQexec(conn, "ROLLBACK");
                res.status = 500;
                res.set_content(json{{"error", "Failed to update listing quantity"}}.dump(), "application/json");
                return;
            }
            PQclear(updateRes);
            PQexec(conn, "COMMIT");

            res.set_content(json{{"message", "Order accepted successfully"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            PQexec(Database::getInstance().getConnection(), "ROLLBACK");
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/orders/:id/reject ────────────────────────────
    // Farmer rejects a pending order — no quantity to restore
    server.Put(R"(/api/orders/(\d+)/reject)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "FARMER") {
            res.status = 403;
            res.set_content(json{{"error", "Only farmers can reject orders"}}.dump(), "application/json");
            return;
        }

        try {
            std::string orderId = req.matches[1];
            PGconn* conn = Database::getInstance().getConnection();

            std::string fetchSql =
                "SELECT o.status, l.user_id as farmer_id "
                "FROM orders o JOIN listings l ON o.listing_id = l.id "
                "WHERE o.id = $1";
            const char* fetchParams[1] = { orderId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Order not found"}}.dump(), "application/json");
                return;
            }

            std::string status = PQgetvalue(fetchRes, 0, 0);
            int farmerId       = std::stoi(PQgetvalue(fetchRes, 0, 1));
            PQclear(fetchRes);

            if (farmerId != payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You can only reject orders on your own listings"}}.dump(), "application/json");
                return;
            }

            if (status != "Pending") {
                res.status = 409;
                res.set_content(json{{"error", "Only pending orders can be rejected"}}.dump(), "application/json");
                return;
            }

            std::string rejectSql = "UPDATE orders SET status = 'Rejected' WHERE id = $1";
            const char* rejectParams[1] = { orderId.c_str() };
            PGresult* rejectRes = PQexecParams(conn, rejectSql.c_str(), 1, nullptr, rejectParams, nullptr, nullptr, 0);

            if (PQresultStatus(rejectRes) != PGRES_COMMAND_OK) {
                PQclear(rejectRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to reject order"}}.dump(), "application/json");
                return;
            }
            PQclear(rejectRes);

            res.set_content(json{{"message", "Order rejected"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/orders/:id/cancel ────────────────────────────
    // Buyer OR farmer cancels — restores qty only if order was Accepted
    server.Put(R"(/api/orders/(\d+)/cancel)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            std::string orderId = req.matches[1];
            PGconn* conn = Database::getInstance().getConnection();

            std::string fetchSql =
                "SELECT o.listing_id, o.buyer_id, o.quantity_ordered, o.status, "
                "l.user_id as farmer_id "
                "FROM orders o JOIN listings l ON o.listing_id = l.id "
                "WHERE o.id = $1";
            const char* fetchParams[1] = { orderId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Order not found"}}.dump(), "application/json");
                return;
            }

            int listingId      = std::stoi(PQgetvalue(fetchRes, 0, 0));
            int buyerId        = std::stoi(PQgetvalue(fetchRes, 0, 1));
            double qtyOrdered  = std::stod(PQgetvalue(fetchRes, 0, 2));
            std::string status = PQgetvalue(fetchRes, 0, 3);
            int farmerId       = std::stoi(PQgetvalue(fetchRes, 0, 4));
            PQclear(fetchRes);

            // Only the buyer or the farmer can cancel
            if (payload.userId != buyerId && payload.userId != farmerId) {
                res.status = 403;
                res.set_content(json{{"error", "Not authorized to cancel this order"}}.dump(), "application/json");
                return;
            }

            if (status == "Completed" || status == "Rejected") {
                res.status = 409;
                res.set_content(json{{"error", "Cannot cancel a " + status + " order"}}.dump(), "application/json");
                return;
            }

            if (status == "Cancelled") {
                res.status = 409;
                res.set_content(json{{"error", "Order is already cancelled"}}.dump(), "application/json");
                return;
            }

            PQexec(conn, "BEGIN");

            std::string cancelSql = "UPDATE orders SET status = 'Cancelled' WHERE id = $1";
            const char* cancelParams[1] = { orderId.c_str() };
            PGresult* cancelRes = PQexecParams(conn, cancelSql.c_str(), 1, nullptr, cancelParams, nullptr, nullptr, 0);

            if (PQresultStatus(cancelRes) != PGRES_COMMAND_OK) {
                PQclear(cancelRes);
                PQexec(conn, "ROLLBACK");
                res.status = 500;
                res.set_content(json{{"error", "Failed to cancel order"}}.dump(), "application/json");
                return;
            }
            PQclear(cancelRes);

            // Only restore quantity if order was already Accepted
            if (status == "Accepted") {
                std::string listingIdStr = std::to_string(listingId);
                std::string qtyStr       = std::to_string(qtyOrdered);

                std::string restoreSql =
                    "UPDATE listings SET "
                    "available_qty = available_qty + $1, "
                    "status = 'Available'::listing_status_enum "
                    "WHERE id = $2";
                const char* restoreParams[2] = { qtyStr.c_str(), listingIdStr.c_str() };
                PGresult* restoreRes = PQexecParams(conn, restoreSql.c_str(), 2, nullptr, restoreParams, nullptr, nullptr, 0);

                if (PQresultStatus(restoreRes) != PGRES_COMMAND_OK) {
                    PQclear(restoreRes);
                    PQexec(conn, "ROLLBACK");
                    res.status = 500;
                    res.set_content(json{{"error", "Failed to restore listing quantity"}}.dump(), "application/json");
                    return;
                }
                PQclear(restoreRes);
            }

            PQexec(conn, "COMMIT");
            res.set_content(json{{"message", "Order cancelled successfully"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            PQexec(Database::getInstance().getConnection(), "ROLLBACK");
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/orders/:id/complete ──────────────────────────
    // Buyer: anytime after Accepted
    // Farmer: only if order Accepted for 2+ days with no transport job linked
    server.Put(R"(/api/orders/(\d+)/complete)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            std::string orderId = req.matches[1];
            PGconn* conn = Database::getInstance().getConnection();

            std::string fetchSql =
                "SELECT o.buyer_id, o.status, o.created_at, "
                "l.user_id as farmer_id, "
                "EXTRACT(EPOCH FROM (NOW() - o.created_at)) as seconds_since_created, "
                "(SELECT COUNT(*) FROM transport_jobs tj WHERE tj.order_id = o.id) as transport_count "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "WHERE o.id = $1";
            const char* fetchParams[1] = { orderId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Order not found"}}.dump(), "application/json");
                return;
            }

            int buyerId              = std::stoi(PQgetvalue(fetchRes, 0, 0));
            std::string status       = PQgetvalue(fetchRes, 0, 1);
            int farmerId             = std::stoi(PQgetvalue(fetchRes, 0, 3));
            double secondsSinceCreated = std::stod(PQgetvalue(fetchRes, 0, 4));
            int transportCount       = std::stoi(PQgetvalue(fetchRes, 0, 5));
            PQclear(fetchRes);

            if (status != "Accepted") {
                res.status = 409;
                res.set_content(json{{"error", "Only accepted orders can be marked as completed"}}.dump(), "application/json");
                return;
            }

            bool isBuyer  = payload.userId == buyerId;
            bool isFarmer = payload.userId == farmerId;

            if (!isBuyer && !isFarmer) {
                res.status = 403;
                res.set_content(json{{"error", "Not authorized"}}.dump(), "application/json");
                return;
            }

            // Farmer can only complete if 2+ days passed AND no transport job linked
            if (isFarmer && !isBuyer) {
                double twoDaysInSeconds = 2 * 24 * 60 * 60;
                if (secondsSinceCreated < twoDaysInSeconds) {
                    res.status = 403;
                    res.set_content(json{{
                        "error", "You can only mark this complete 2 days after acceptance if no transport has been requested"
                    }}.dump(), "application/json");
                    return;
                }
                if (transportCount > 0) {
                    res.status = 403;
                    res.set_content(json{{
                        "error", "A transport job is linked to this order. Completion is handled through transport."
                    }}.dump(), "application/json");
                    return;
                }
            }

            std::string completeSql = "UPDATE orders SET status = 'Completed' WHERE id = $1";
            const char* completeParams[1] = { orderId.c_str() };
            PGresult* completeRes = PQexecParams(conn, completeSql.c_str(), 1, nullptr, completeParams, nullptr, nullptr, 0);

            if (PQresultStatus(completeRes) != PGRES_COMMAND_OK) {
                PQclear(completeRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to complete order"}}.dump(), "application/json");
                return;
            }
            PQclear(completeRes);

            res.set_content(json{{"message", "Order marked as completed"}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}