#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../db/Database.h"
#include "AuthMiddleware.h"
#include <string>

using json = nlohmann::json;

inline void registerTransportRoutes(httplib::Server& server, const std::string& jwtSecret) {

    // ── POST /api/transport ───────────────────────────────────
    // Farmer or buyer linked to an accepted order creates a transport job
    server.Post("/api/transport", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            auto body   = json::parse(req.body);
            int orderId = body.value("orderId", 0);

            if (orderId <= 0) {
                res.status = 400;
                res.set_content(json{{"error", "orderId is required"}}.dump(), "application/json");
                return;
            }

            std::string pickupLocation      = body.value("pickupLocation", "");
            std::string destination         = body.value("destination", "");
            std::string cargoDesc           = body.value("cargoDesc", "");
            std::string transportDate       = body.value("transportDate", "");
            std::string specialInstructions = body.value("specialInstructions", "");
            double estimatedWeight          = body.value("estimatedWeight", 0.0);
            double price                    = body.value("price", 0.0);

            if (pickupLocation.empty() || destination.empty()) {
                res.status = 400;
                res.set_content(json{{"error", "pickupLocation and destination are required"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Verify order exists, is Accepted, and user is farmer or buyer
            std::string orderIdStr = std::to_string(orderId);
            std::string fetchSql =
                "SELECT o.status, o.buyer_id, o.listing_id, o.quantity_ordered, "
                "l.user_id as farmer_id, l.crop_name, l.pickup_location "
                "FROM orders o "
                "JOIN listings l ON o.listing_id = l.id "
                "WHERE o.id = $1";
            const char* fetchParams[1] = { orderIdStr.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Order not found"}}.dump(), "application/json");
                return;
            }

            std::string orderStatus = PQgetvalue(fetchRes, 0, 0);
            int buyerId             = std::stoi(PQgetvalue(fetchRes, 0, 1));
            int farmerId            = std::stoi(PQgetvalue(fetchRes, 0, 4));
            std::string cropName    = PQgetvalue(fetchRes, 0, 5);
            std::string defaultPickup = PQgetvalue(fetchRes, 0, 6);
            double qtyOrdered       = std::stod(PQgetvalue(fetchRes, 0, 3));
            int listingId           = std::stoi(PQgetvalue(fetchRes, 0, 2));
            PQclear(fetchRes);

            if (orderStatus != "Accepted") {
                res.status = 409;
                res.set_content(json{{"error", "Transport can only be requested for accepted orders"}}.dump(), "application/json");
                return;
            }

            if (payload.userId != buyerId && payload.userId != farmerId) {
                res.status = 403;
                res.set_content(json{{"error", "Only the farmer or buyer of this order can request transport"}}.dump(), "application/json");
                return;
            }

            // Check if transport already exists for this order
            std::string checkSql = "SELECT id FROM transport_jobs WHERE order_id = $1";
            const char* checkParams[1] = { orderIdStr.c_str() };
            PGresult* checkRes = PQexecParams(conn, checkSql.c_str(), 1, nullptr, checkParams, nullptr, nullptr, 0);
            bool alreadyExists = PQntuples(checkRes) > 0;
            PQclear(checkRes);

            if (alreadyExists) {
                res.status = 409;
                res.set_content(json{{"error", "A transport job already exists for this order"}}.dump(), "application/json");
                return;
            }

            // Use listing pickup location as default if not provided
            if (pickupLocation.empty()) pickupLocation = defaultPickup;

            // Set cargo desc from order if not provided
            if (cargoDesc.empty()) cargoDesc = cropName + " - " + std::to_string(qtyOrdered) + "kg";

            std::string requestedByStr     = std::to_string(payload.userId);
            std::string listingIdStr       = std::to_string(listingId);
            std::string estimatedWeightStr = std::to_string(estimatedWeight);
            std::string priceStr           = std::to_string(price);

            std::string insertSql =
                "INSERT INTO transport_jobs "
                "(order_id, listing_id, requested_by, pickup_location, destination, "
                "cargo_desc, transport_date, estimated_weight, price, special_instructions) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10) "
                "RETURNING id";

            const char* insertParams[10] = {
                orderIdStr.c_str(), listingIdStr.c_str(), requestedByStr.c_str(),
                pickupLocation.c_str(), destination.c_str(), cargoDesc.c_str(),
                transportDate.empty() ? nullptr : transportDate.c_str(),
                estimatedWeightStr.c_str(), priceStr.c_str(),
                specialInstructions.c_str()
            };

            // Handle nullable date
            int paramLengths[10]  = {0};
            int paramFormats[10]  = {0};
            const Oid paramTypes[10] = {0};

            PGresult* insertRes = PQexecParams(
                conn, insertSql.c_str(), 10, nullptr,
                insertParams, nullptr, nullptr, 0
            );

            if (PQresultStatus(insertRes) != PGRES_TUPLES_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(insertRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to create transport job: " + err}}.dump(), "application/json");
                return;
            }

            int newId = std::stoi(PQgetvalue(insertRes, 0, 0));
            PQclear(insertRes);

            res.status = 201;
            res.set_content(json{
                {"message",  "Transport job created successfully"},
                {"jobId",    newId}
            }.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/transport/available ─────────────────────────
    // Transporters browse all unassigned jobs
    server.Get("/api/transport/available", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
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

            std::string sql =
                "SELECT tj.id, tj.pickup_location, tj.destination, tj.cargo_desc, "
                "tj.transport_date, tj.estimated_weight, tj.price, tj.special_instructions, "
                "tj.status, tj.created_at, "
                "u.id as requester_id, u.name as requester_name, u.phone as requester_phone, "
                "l.crop_name "
                "FROM transport_jobs tj "
                "JOIN users u ON tj.requested_by = u.id "
                "LEFT JOIN listings l ON tj.listing_id = l.id "
                "WHERE tj.is_assigned = false AND tj.status = 'Pending' "
                "ORDER BY tj.created_at DESC";

            PGresult* result = PQexec(conn, sql.c_str());

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
                json job = {
                    {"id",                  std::stoi(PQgetvalue(result, i, 0))},
                    {"pickupLocation",      PQgetvalue(result, i, 1)},
                    {"destination",         PQgetvalue(result, i, 2)},
                    {"cargoDesc",           PQgetvalue(result, i, 3)},
                    {"transportDate",       PQgetvalue(result, i, 4)},
                    {"estimatedWeight",     PQgetisnull(result, i, 5) ? 0.0 : std::stod(PQgetvalue(result, i, 5))},
                    {"price",               PQgetisnull(result, i, 6) ? 0.0 : std::stod(PQgetvalue(result, i, 6))},
                    {"specialInstructions", PQgetvalue(result, i, 7)},
                    {"status",              PQgetvalue(result, i, 8)},
                    {"createdAt",           PQgetvalue(result, i, 9)},
                    {"requestedBy", {
                        {"id",    std::stoi(PQgetvalue(result, i, 10))},
                        {"name",  PQgetvalue(result, i, 11)},
                        {"phone", PQgetvalue(result, i, 12)}
                    }},
                    {"cropName", PQgetvalue(result, i, 13)}
                };
                jobs.push_back(job);
            }
            PQclear(result);

            res.set_content(jobs.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/transport/my ─────────────────────────────────
    // Transporter sees their accepted/active jobs
    server.Get("/api/transport/my", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
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

            std::string transporterIdStr = std::to_string(payload.userId);
            std::string sql =
                "SELECT tj.id, tj.pickup_location, tj.destination, tj.cargo_desc, "
                "tj.transport_date, tj.estimated_weight, tj.price, "
                "tj.special_instructions, tj.status, tj.created_at, "
                "u.id as requester_id, u.name as requester_name, u.phone as requester_phone, "
                "l.crop_name "
                "FROM transport_jobs tj "
                "JOIN users u ON tj.requested_by = u.id "
                "LEFT JOIN listings l ON tj.listing_id = l.id "
                "WHERE tj.transporter_id = $1 "
                "ORDER BY tj.created_at DESC";

            const char* params[1] = { transporterIdStr.c_str() };
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
                    {"id",                  std::stoi(PQgetvalue(result, i, 0))},
                    {"pickupLocation",      PQgetvalue(result, i, 1)},
                    {"destination",         PQgetvalue(result, i, 2)},
                    {"cargoDesc",           PQgetvalue(result, i, 3)},
                    {"transportDate",       PQgetvalue(result, i, 4)},
                    {"estimatedWeight",     PQgetisnull(result, i, 5) ? 0.0 : std::stod(PQgetvalue(result, i, 5))},
                    {"price",               PQgetisnull(result, i, 6) ? 0.0 : std::stod(PQgetvalue(result, i, 6))},
                    {"specialInstructions", PQgetvalue(result, i, 7)},
                    {"status",              PQgetvalue(result, i, 8)},
                    {"createdAt",           PQgetvalue(result, i, 9)},
                    {"requestedBy", {
                        {"id",    std::stoi(PQgetvalue(result, i, 10))},
                        {"name",  PQgetvalue(result, i, 11)},
                        {"phone", PQgetvalue(result, i, 12)}
                    }},
                    {"cropName", PQgetvalue(result, i, 13)}
                });
            }
            PQclear(result);

            res.set_content(jobs.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/transport/:id/accept ─────────────────────────
    // Transporter accepts an available job
    server.Put(R"(/api/transport/(\d+)/accept)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "TRANSPORTER") {
            res.status = 403;
            res.set_content(json{{"error", "Transporters only"}}.dump(), "application/json");
            return;
        }

        try {
            std::string jobId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Check job exists and is unassigned
            std::string fetchSql =
                "SELECT is_assigned, status FROM transport_jobs WHERE id = $1";
            const char* fetchParams[1] = { jobId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Transport job not found"}}.dump(), "application/json");
                return;
            }

            std::string isAssigned = PQgetvalue(fetchRes, 0, 0);
            std::string status     = PQgetvalue(fetchRes, 0, 1);
            PQclear(fetchRes);

            if (isAssigned == "t" || status != "Pending") {
                res.status = 409;
                res.set_content(json{{"error", "Job is already assigned or no longer available"}}.dump(), "application/json");
                return;
            }

            std::string transporterIdStr = std::to_string(payload.userId);
            std::string updateSql =
                "UPDATE transport_jobs SET "
                "is_assigned = true, "
                "transporter_id = $1, "
                "status = 'In_Transit'::transport_status_enum "
                "WHERE id = $2 AND is_assigned = false";

            const char* updateParams[2] = { transporterIdStr.c_str(), jobId.c_str() };
            PGresult* updateRes = PQexecParams(conn, updateSql.c_str(), 2, nullptr, updateParams, nullptr, nullptr, 0);

            if (PQresultStatus(updateRes) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(updateRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to accept job: " + err}}.dump(), "application/json");
                return;
            }

            int affected = std::stoi(PQcmdTuples(updateRes));
            PQclear(updateRes);

            // If 0 rows affected another transporter just accepted it
            if (affected == 0) {
                res.status = 409;
                res.set_content(json{{"error", "Job was just taken by another transporter"}}.dump(), "application/json");
                return;
            }

            res.set_content(json{{"message", "Job accepted. Status set to In Transit."}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── PUT /api/transport/:id/status ─────────────────────────
    // Transporter updates delivery status
    server.Put(R"(/api/transport/(\d+)/status)", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        if (payload.userType != "TRANSPORTER") {
            res.status = 403;
            res.set_content(json{{"error", "Transporters only"}}.dump(), "application/json");
            return;
        }

        try {
            std::string jobId = req.matches[1];
            auto body         = json::parse(req.body);
            std::string newStatus = body.value("status", "");

            if (newStatus != "In_Transit" && newStatus != "Delivered") {
                res.status = 400;
                res.set_content(json{{"error", "Status must be In_Transit or Delivered"}}.dump(), "application/json");
                return;
            }

            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            // Verify this transporter owns this job
            std::string fetchSql =
                "SELECT transporter_id, status FROM transport_jobs WHERE id = $1";
            const char* fetchParams[1] = { jobId.c_str() };
            PGresult* fetchRes = PQexecParams(conn, fetchSql.c_str(), 1, nullptr, fetchParams, nullptr, nullptr, 0);

            if (PQntuples(fetchRes) == 0) {
                PQclear(fetchRes);
                res.status = 404;
                res.set_content(json{{"error", "Job not found"}}.dump(), "application/json");
                return;
            }

            int transporterId    = PQgetisnull(fetchRes, 0, 0) ? -1 : std::stoi(PQgetvalue(fetchRes, 0, 0));
            std::string curStatus = PQgetvalue(fetchRes, 0, 1);
            PQclear(fetchRes);

            if (transporterId != payload.userId) {
                res.status = 403;
                res.set_content(json{{"error", "You can only update your own jobs"}}.dump(), "application/json");
                return;
            }

            if (curStatus == "Delivered") {
                res.status = 409;
                res.set_content(json{{"error", "Job is already marked as delivered"}}.dump(), "application/json");
                return;
            }

            std::string updateSql =
                "UPDATE transport_jobs SET status = $1::transport_status_enum WHERE id = $2";
            const char* updateParams[2] = { newStatus.c_str(), jobId.c_str() };
            PGresult* updateRes = PQexecParams(conn, updateSql.c_str(), 2, nullptr, updateParams, nullptr, nullptr, 0);

            if (PQresultStatus(updateRes) != PGRES_COMMAND_OK) {
                std::string err = PQerrorMessage(conn);
                PQclear(updateRes);
                res.status = 500;
                res.set_content(json{{"error", "Failed to update status: " + err}}.dump(), "application/json");
                return;
            }
            PQclear(updateRes);

            res.set_content(json{{"message", "Status updated to " + newStatus}}.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // ── GET /api/transport/order/:orderId ─────────────────────
    // Check if a transport job exists for an order
    server.Get(R"(/api/transport/order/(\d+))", [jwtSecret](const httplib::Request& req, httplib::Response& res) {
        JwtPayload payload;
        if (!requireAuth(req, res, jwtSecret, payload)) return;

        try {
            std::string orderId = req.matches[1];
            ScopedConn scoped(Database::getInstance().getConnectionString());
            PGconn* conn = scoped.get();

            std::string sql =
                "SELECT id, status, is_assigned, pickup_location, destination, "
                "cargo_desc, transport_date, estimated_weight, price "
                "FROM transport_jobs WHERE order_id = $1";
            const char* params[1] = { orderId.c_str() };
            PGresult* result = PQexecParams(conn, sql.c_str(), 1, nullptr, params, nullptr, nullptr, 0);

            if (PQntuples(result) == 0) {
                PQclear(result);
                res.set_content(json{{"exists", false}}.dump(), "application/json");
                return;
            }

            json job = {
                {"exists",          true},
                {"id",              std::stoi(PQgetvalue(result, 0, 0))},
                {"status",          PQgetvalue(result, 0, 1)},
                {"isAssigned",      std::string(PQgetvalue(result, 0, 2)) == "t"},
                {"pickupLocation",  PQgetvalue(result, 0, 3)},
                {"destination",     PQgetvalue(result, 0, 4)},
                {"cargoDesc",       PQgetvalue(result, 0, 5)},
                {"transportDate",   PQgetvalue(result, 0, 6)},
                {"estimatedWeight", PQgetisnull(result, 0, 7) ? 0.0 : std::stod(PQgetvalue(result, 0, 7))},
                {"price",           PQgetisnull(result, 0, 8) ? 0.0 : std::stod(PQgetvalue(result, 0, 8))}
            };
            PQclear(result);

            res.set_content(job.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });
}