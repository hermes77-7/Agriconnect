#pragma once
#include <string>

class Password {
public:
    // Hash a plain text password
    static std::string hash(const std::string& password);

    // Verify a plain text password against a stored hash
    static bool verify(const std::string& password, const std::string& hash);
};
