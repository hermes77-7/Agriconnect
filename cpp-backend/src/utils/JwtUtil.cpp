#include "JwtUtil.h"
#include "../../external/jwt.h"
#include <chrono>
#include <iostream>

std::string JwtUtil::generate(const JwtPayload& payload, const std::string& secret) {
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::hours(24);

    return jwt::create()
        .set_issuer("agriconnect")
        .set_subject(std::to_string(payload.userId))
        .set_payload_claim("email",     jwt::claim(payload.email))
        .set_payload_claim("user_type", jwt::claim(payload.userType))
        .set_issued_at(now)
        .set_expires_at(exp)
        .sign(jwt::algorithm::hs256{secret});
}

bool JwtUtil::verify(const std::string& token, const std::string& secret, JwtPayload& outPayload) {
    try {
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{secret})
            .with_issuer("agriconnect");

        auto decoded = jwt::decode(token);
        verifier.verify(decoded);

        outPayload.userId   = std::stoi(decoded.get_subject());
        outPayload.email    = decoded.get_payload_claim("email").as_string();
        outPayload.userType = decoded.get_payload_claim("user_type").as_string();
        return true;
    } catch (const std::exception& e) {
        std::cerr << "JWT error: " << e.what() << "\n";
        return false;
    }
}