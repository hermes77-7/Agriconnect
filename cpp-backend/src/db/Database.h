#pragma once
#include <string>
#include <libpq-fe.h>
#include <stdexcept>
#include <iostream>

// Returns a new connection for each request
// Caller is responsible for calling PQfinish() when done
class Database {
public:
    static Database& getInstance();
    PGconn* getConnection();   // kept for health check only
    bool isConnected();
    void connect(const std::string& connStr);
    void disconnect();

    // Use this for all route handlers
    PGconn* newConnection();
    const std::string& getConnectionString() const { return connectionString_; }

private:
    Database() : conn(nullptr) {}
    PGconn* conn;
    std::string connectionString_;
};

// RAII wrapper — auto-closes connection when it goes out of scope
struct ScopedConn {
    PGconn* conn;

    ScopedConn(const std::string& connStr) {
        conn = PQconnectdb(connStr.c_str());
        if (PQstatus(conn) != CONNECTION_OK) {
            std::string err = PQerrorMessage(conn);
            PQfinish(conn);
            conn = nullptr;
            throw std::runtime_error("DB connection failed: " + err);
        }
    }

    ~ScopedConn() {
        if (conn) PQfinish(conn);
    }

    // Prevent copying
    ScopedConn(const ScopedConn&)            = delete;
    ScopedConn& operator=(const ScopedConn&) = delete;

    PGconn* get() { return conn; }
};