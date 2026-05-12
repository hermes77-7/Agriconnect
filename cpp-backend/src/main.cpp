#include "../external/httplib.h"
#include "../external/json.hpp"

using json = nlohmann::json;

int main() {
    httplib::Server server;

    server.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        json response = {
            {"status", "ok"},
            {"message", "Agriconnect backend running"}
        };

        res.set_content(response.dump(), "application/json");
    });

    server.Post("/analyze", [](const httplib::Request&, httplib::Response& res) {
        json response = {
            {"status", "success"},
            {"result", "Healthy"},
            {"confidence", 0.92},
            {"recommendations", {
                "Continue regular watering",
                "Monitor leaf coloration"
            }}
        };

        res.set_content(response.dump(), "application/json");
    });

    server.listen("0.0.0.0", 5000);

    return 0;
}