cmake_minimum_required(VERSION 3.15)

project(AgriconnectBackend)

set(CMAKE_CXX_STANDARD 17)

add_definitions(-DCPPHTTPLIB_NO_MMAP)

add_executable(
    agriconnect_backend
    src/main.cpp
)

target_link_libraries(agriconnect_backend ws2_32)