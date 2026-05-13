#include "Password.h"
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>
#include <stdexcept>

// Generates a random hex salt
static std::string generateSalt(int length = 16) {
    unsigned char buf[16];
    RAND_bytes(buf, length);
    std::ostringstream oss;
    for (int i = 0; i < length; i++)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)buf[i];
    return oss.str();
}

// PBKDF2-SHA256 with 100,000 iterations
static std::string pbkdf2(const std::string& password, const std::string& salt) {
    unsigned char out[32];
    PKCS5_PBKDF2_HMAC(
        password.c_str(), password.size(),
        (const unsigned char*)salt.c_str(), salt.size(),
        100000,
        EVP_sha256(),
        32, out
    );
    std::ostringstream oss;
    for (int i = 0; i < 32; i++)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)out[i];
    return oss.str();
}

std::string Password::hash(const std::string& password) {
    std::string salt = generateSalt();
    std::string hashed = pbkdf2(password, salt);
    // Store as salt:hash so we can verify later
    return salt + ":" + hashed;
}

bool Password::verify(const std::string& password, const std::string& stored) {
    auto pos = stored.find(':');
    if (pos == std::string::npos) return false;
    std::string salt   = stored.substr(0, pos);
    std::string expected = stored.substr(pos + 1);
    std::string actual = pbkdf2(password, salt);
    return actual == expected;
}