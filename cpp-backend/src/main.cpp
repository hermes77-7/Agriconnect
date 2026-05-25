#include "../external/httplib.h"
#include "../external/json.hpp"
#include "db/Database.h"
#include "api/AuthMiddleware.h"
#include "api/AuthRoutes.h"
#include "api/ListingRoutes.h"
#include "api/AnalysisRoutes.h"
#include "api/OrderRoutes.h"
#include "api/TransportRoutes.h"
#include <iostream>
#include <fstream>
#include <map>
#include "api/TransportRoutes.h"

using json = nlohmann::json;

std::map<std::string, std::string> loadEnv(const std::string& path) {
    std::map<std::string, std::string> env;
    std::ifstream file(path);
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') continue;
        if (!line.empty() && line.back() == '\r') line.pop_back();
        auto pos = line.find('=');
        if (pos == std::string::npos) continue;
        env[line.substr(0, pos)] = line.substr(pos + 1);
    }
    return env;
}

int main() {
    auto env = loadEnv("../.env");

    std::string connStr =
        "host="      + env["DB_HOST"]     +
        " port="     + env["DB_PORT"]     +
        " dbname="   + env["DB_NAME"]     +
        " user="     + env["DB_USER"]     +
        " password=" + env["DB_PASSWORD"];

    try {
        Database::getInstance().connect(connStr);
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
        return 1;
    }

    std::string jwtSecret  = env.count("JWT_SECRET")   ? env["JWT_SECRET"]   : "changeme_secret";
    std::string uploadDir  = env.count("UPLOAD_DIR")   ? env["UPLOAD_DIR"]   : "../uploads";

    httplib::Server server;

    // Increase body size limit for image uploads (10MB)
    server.set_payload_max_length(10 * 1024 * 1024);

    server.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(json{
            {"status",   "ok"},
            {"database", Database::getInstance().isConnected() ? "connected" : "disconnected"}
        }.dump(), "application/json");
    });

    registerAuthRoutes(server, jwtSecret);
    registerListingRoutes(server, jwtSecret);
    registerOrderRoutes(server, jwtSecret);
    registerTransportRoutes(server, jwtSecret);
    registerAnalysisRoutes(server, jwtSecret, uploadDir);

    std::cout << "Agriconnect backend running on port 5000\n";
    server.listen("0.0.0.0", 5000);

    Database::getInstance().disconnect();
    return 0;
}