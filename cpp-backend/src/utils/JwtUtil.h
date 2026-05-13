#pragma once
#include <string>
#include <map>

struct JwtPayload {
    int userId;
    std::string email;
    std::string userType;
};

class JwtUtil {
public:
    static std::string generate(const JwtPayload& payload, const std::string& secret);
    static bool verify(const std::string& token, const std::string& secret, JwtPayload& outPayload);
};