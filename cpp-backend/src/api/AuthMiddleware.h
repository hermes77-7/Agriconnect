#pragma once
#include "../../external/httplib.h"
#include "../../external/json.hpp"
#include "../utils/JwtUtil.h"
#include <cctype>
#include <algorithm>

using json = nlohmann::json;

// Call this at the top of any protected route handler
// Returns true if valid, false if already sent 401
inline bool requireAuth(const httplib::Request& req, httplib::Response& res,
                         const std::string& secret, JwtPayload& outPayload) {
    std::string authHeader = req.get_header_value("Authorization");

    if (authHeader.empty() || authHeader.rfind("Bearer ", 0) != 0) {
        res.status = 401;
        res.set_content(json{{"error", "Missing or invalid Authorization header"}}.dump(), "application/json");
        return false;
    }

    std::string token = authHeader.substr(7);

    // Strip any whitespace, newlines or carriage returns from the token
    token.erase(std::remove_if(token.begin(), token.end(), [](unsigned char c) {
        return std::isspace(c);
    }), token.end());

    if (!JwtUtil::verify(token, secret, outPayload)) {
        res.status = 401;
        res.set_content(json{{"error", "Invalid or expired token"}}.dump(), "application/json");
        return false;
    }

    return true;
}