#pragma once
#include <string>
#include <libpq-fe.h>

class Database {
public:
    static Database& getInstance();
    PGconn* getConnection();
    bool isConnected();
    void connect(const std::string& connStr);
    void disconnect();

private:
    Database() : conn(nullptr) {}
    PGconn* conn;
};