#include "api_client.hpp"
#include <iostream>
#include <sstream>

// Standard single-header JSON parser or lightweight struct parsing
#if __has_include(<nlohmann/json.hpp>)
#include <nlohmann/json.hpp>
using json = nlohmann::json;
#endif

namespace StreamTV {

ApiClient::ApiClient() {
    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();
}

ApiClient::~ApiClient() {
    if (curl) {
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
}

size_t ApiClient::WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t totalSize = size * nmemb;
    std::string* str = static_cast<std::string*>(userp);
    str->append(static_cast<char*>(contents), totalSize);
    return totalSize;
}

std::string ApiClient::httpGet(const std::string& url, const std::string& token) {
    if (!curl) return "";

    std::string readBuffer;
    curl_easy_reset(curl);
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

    struct curl_slist* headers = nullptr;
    if (!token.empty()) {
        std::string authHeader = "Authorization: Bearer " + token;
        headers = curl_slist_append(headers, authHeader.c_str());
    }
    headers = curl_slist_append(headers, "User-Agent: StreamTV-Horizon-Switch/1.0");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(curl);
    if (headers) curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        std::cerr << "[ApiClient] GET failed: " << curl_easy_strerror(res) << std::endl;
        return "";
    }
    return readBuffer;
}

std::string ApiClient::httpPost(const std::string& url, const std::string& jsonBody) {
    if (!curl) return "";

    std::string readBuffer;
    curl_easy_reset(curl);
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonBody.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "User-Agent: StreamTV-Horizon-Switch/1.0");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(curl);
    if (headers) curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        std::cerr << "[ApiClient] POST failed: " << curl_easy_strerror(res) << std::endl;
        return "";
    }
    return readBuffer;
}

AuthResult ApiClient::login(const std::string& baseUrl, const std::string& email, const std::string& password) {
    AuthResult result;
    std::string url = baseUrl + "/api/login";
    std::string body = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";

    std::string response = httpPost(url, body);
    if (response.empty()) {
        result.errorMessage = "Error de conexion con el servidor StreamTV";
        return result;
    }

#if __has_include(<nlohmann/json.hpp>)
    try {
        auto j = json::parse(response);
        if (j.contains("token")) {
            result.success = true;
            result.token = j["token"].get<std::string>();
            if (j.contains("user")) {
                result.email = j["user"].value("email", email);
                result.role = j["user"].value("role", "user");
            }
        } else if (j.contains("error")) {
            result.errorMessage = j["error"].get<std::string>();
        }
    } catch (const std::exception& e) {
        result.errorMessage = "Error al procesar respuesta de login";
    }
#else
    if (response.find("\"token\"") != std::string::npos) {
        result.success = true;
        size_t start = response.find("\"token\":\"") + 9;
        size_t end = response.find("\"", start);
        result.token = response.substr(start, end - start);
    } else {
        result.errorMessage = "Respuesta no valida";
    }
#endif

    return result;
}

std::vector<LiveChannel> ApiClient::fetchLiveChannels(const std::string& baseUrl, const std::string& token) {
    std::vector<LiveChannel> channels;
    std::string url = baseUrl + "/api/live";
    std::string response = httpGet(url, token);

    if (response.empty()) return channels;

#if __has_include(<nlohmann/json.hpp>)
    try {
        auto j = json::parse(response);
        if (j.is_array()) {
            for (const auto& item : j) {
                LiveChannel ch;
                ch.id = std::to_string(item.value("id", 0));
                ch.name = item.value("name", "Canal");
                ch.streamId = std::to_string(item.value("stream_id", 0));
                ch.logoUrl = item.value("logo", "");
                ch.categoryName = item.value("category_name", "En Vivo");
                channels.push_back(ch);
            }
        }
    } catch (...) {}
#endif

    return channels;
}

std::vector<MovieItem> ApiClient::fetchMovies(const std::string& baseUrl, const std::string& token) {
    std::vector<MovieItem> movies;
    std::string url = baseUrl + "/api/movies";
    std::string response = httpGet(url, token);

    if (response.empty()) return movies;

#if __has_include(<nlohmann/json.hpp>)
    try {
        auto j = json::parse(response);
        if (j.is_array()) {
            for (const auto& item : j) {
                MovieItem m;
                m.id = std::to_string(item.value("id", 0));
                m.title = item.value("title", "Película");
                m.streamId = std::to_string(item.value("stream_id", 0));
                m.containerExtension = item.value("container_extension", "mp4");
                m.posterUrl = item.value("poster", "");
                m.rating = item.value("rating", "N/A");
                m.year = item.value("year", "");
                movies.push_back(m);
            }
        }
    } catch (...) {}
#endif

    return movies;
}

std::vector<SeriesItem> ApiClient::fetchSeries(const std::string& baseUrl, const std::string& token) {
    std::vector<SeriesItem> seriesList;
    std::string url = baseUrl + "/api/series";
    std::string response = httpGet(url, token);

    if (response.empty()) return seriesList;

#if __has_include(<nlohmann/json.hpp>)
    try {
        auto j = json::parse(response);
        if (j.is_array()) {
            for (const auto& item : j) {
                SeriesItem s;
                s.id = std::to_string(item.value("id", 0));
                s.title = item.value("title", "Serie");
                s.seriesId = std::to_string(item.value("series_id", 0));
                s.posterUrl = item.value("poster", "");
                s.rating = item.value("rating", "N/A");
                s.categoryName = item.value("category_name", "Series");
                seriesList.push_back(s);
            }
        }
    } catch (...) {}
#endif

    return seriesList;
}

std::string ApiClient::buildStreamUrl(const std::string& baseUrl, const std::string& type, const std::string& file, const std::string& token) {
    // Format: http://<server>:8080/api_stream/{type}/{file}?token={token}&force_h264=true&force_aac=true
    std::string streamUrl = baseUrl + "/api_stream/" + type + "/" + file + "?token=" + token + "&force_h264=true&force_aac=true";
    return streamUrl;
}

} // namespace StreamTV
