cmake_minimum_required(VERSION 3.15)

project(AgriconnectBackend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(PostgreSQL REQUIRED)

include_directories(
    external
    ${PostgreSQL_INCLUDE_DIRS}
)

add_executable(agriconnect_backend
    src/main.cpp
    src/db/Database.cpp
)

target_compile_definitions(agriconnect_backend PRIVATE
    CPPHTTPLIB_NO_MMAP
    WIN32_LEAN_AND_MEAN
    _WIN32_WINNT=0x0A00
)

target_link_libraries(agriconnect_backend PRIVATE
    ws2_32
    ${PostgreSQL_LIBRARIES}
)