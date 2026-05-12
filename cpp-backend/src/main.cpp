#include "../external/httplib.h"
#include "../external/json.hpp"
#include "db/Database.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <map>

using json = nlohmann::json;

// Simple .env file reader
std::map<std::string, std::string> loadEnv(const std::string& path) {
    std::map<std::string, std::string> env;
    std::ifstream file(path);
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') continue;
        auto pos = line.find('=');
        if (pos == std::string::npos) continue;
        std::string key   = line.substr(0, pos);
        std::string value = line.substr(pos + 1);
        env[key] = value;
    }
    return env;
}

int main() {
    // Load .env
    auto env = loadEnv("../.env");

    // Build connection string
    std::string connStr =
        "host="     + env["DB_HOST"]     +
        " port="    + env["DB_PORT"]     +
        " dbname="  + env["DB_NAME"]     +
        " user="    + env["DB_USER"]     +
        " password="+ env["DB_PASSWORD"];

    // Connect to PostgreSQL
    try {
        Database::getInstance().connect(connStr);
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
        return 1;
    }

    httplib::Server server;

    server.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        bool dbOk = Database::getInstance().isConnected();
        json response = {
            {"status",   "ok"},
            {"message",  "Agriconnect backend running"},
            {"database", dbOk ? "connected" : "disconnected"}
        };
        res.set_content(response.dump(), "application/json");
    });

    server.Post("/analyze", [](const httplib::Request&, httplib::Response& res) {
        json response = {
            {"status",          "success"},
            {"result",          "Healthy"},
            {"confidence",      0.92},
            {"recommendations", {
                "Continue regular watering",
                "Monitor leaf coloration"
            }}
        };
        res.set_content(response.dump(), "application/json");
    });

    std::cout << "Server running on port 5000\n";
    server.listen("0.0.0.0", 5000);

    Database::getInstance().disconnect();
    return 0;
}