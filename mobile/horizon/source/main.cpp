#include <borealis.hpp>
#include <switch.h>
#include "api_client.hpp"
#include "main_activity.hpp"
#include "config.hpp"
#include <iostream>

int main(int argc, char* argv[]) {
    // 1. Initialize Nintendo Switch network sockets (libnx)
    socketInitializeDefault();

    // 2. Initialize Borealis UI Engine
    brls::Logger::setLogLevel(brls::LogLevel::LOG_DEBUG);
    if (!brls::Application::init("StreamTV")) {
        brls::Logger::error("No se pudo inicializar Borealis UI Engine.");
        socketExit();
        return EXIT_FAILURE;
    }

    // 3. Read backend server URL & credentials from SD card config (sdmc:/switch/StreamTV/config.json)
    // Defaulting to Production Railway Backend
    std::string baseUrl = StreamTV::DEFAULT_SERVER_URL;
    std::string userEmail = StreamTV::DEFAULT_EMAIL;
    std::string userPass = StreamTV::DEFAULT_PASS;

    FILE* configFile = fopen("sdmc:/switch/StreamTV/config.json", "r");
    if (configFile) {
        char buffer[1024] = {0};
        fread(buffer, 1, sizeof(buffer) - 1, configFile);
        fclose(configFile);
        std::string configContent(buffer);
        if (configContent.find("\"server_url\":\"") != std::string::npos) {
            size_t start = configContent.find("\"server_url\":\"") + 14;
            size_t end = configContent.find("\"", start);
            baseUrl = configContent.substr(start, end - start);
        }
        if (configContent.find("\"email\":\"") != std::string::npos) {
            size_t start = configContent.find("\"email\":\"") + 9;
            size_t end = configContent.find("\"", start);
            userEmail = configContent.substr(start, end - start);
        }
        if (configContent.find("\"password\":\"") != std::string::npos) {
            size_t start = configContent.find("\"password\":\"") + 12;
            size_t end = configContent.find("\"", start);
            userPass = configContent.substr(start, end - start);
        }
        brls::Logger::info("Configuracion cargada desde SD: " + baseUrl);
    } else {
        brls::Logger::info("No se encontro config.json en SD. Usando URL por defecto: " + baseUrl);
    }
    
    // 4. Authenticate with StreamTV Backend & Neon Database
    StreamTV::ApiClient client;
    StreamTV::AuthResult auth = client.login(baseUrl, userEmail, userPass);

    if (auth.success) {
        brls::Logger::info("Autenticacion exitosa para: " + auth.email);
    } else {
        brls::Logger::warning("Autenticacion inicial fallida: " + auth.errorMessage + ". Usando modo demo/offline.");
    }

    // 4. Load Main Activity (TabFrame with Live TV, Movies, Series)
    StreamTV::MainActivity* mainView = new StreamTV::MainActivity(baseUrl, auth);
    brls::Application::pushView(mainView);

    // 5. Execute main event & rendering loop
    while (brls::Application::mainLoop()) {
        // Main loop iteration handled by Borealis
    }

    // 6. Clean exit
    socketExit();
    return EXIT_SUCCESS;
}
