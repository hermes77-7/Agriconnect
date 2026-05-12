#include "Database.h"
#include <iostream>
#include <stdexcept>

Database& Database::getInstance() {
    static Database instance;
    return instance;
}

void Database::connect(const std::string& connStr) {
    conn = PQconnectdb(connStr.c_str());
    if (PQstatus(conn) != CONNECTION_OK) {
        std::string err = PQerrorMessage(conn);
        PQfinish(conn);
        conn = nullptr;
        throw std::runtime_error("DB connection failed: " + err);
    }
    std::cout << "PostgreSQL connected successfully\n";
}

bool Database::isConnected() {
    return conn != nullptr && PQstatus(conn) == CONNECTION_OK;
}

PGconn* Database::getConnection() {
    return conn;
}

void Database::disconnect() {
    if (conn) {
        PQfinish(conn);
        conn = nullptr;
    }
}