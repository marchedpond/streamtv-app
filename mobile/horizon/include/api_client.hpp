#ifndef API_CLIENT_HPP
#define API_CLIENT_HPP

#include <string>
#include <vector>
#include <memory>
#include <curl/curl.h>

namespace StreamTV {

struct LiveChannel {
    std::string id;
    std::string name;
    std::string streamId;
    std::string logoUrl;
    std::string categoryName;
};

struct MovieItem {
    std::string id;
    std::string title;
    std::string streamId;
    std::string containerExtension;
    std::string posterUrl;
    std::string rating;
    std::string year;
};

struct SeriesItem {
    std::string id;
    std::string title;
    std::string seriesId;
    std::string posterUrl;
    std::string rating;
    std::string categoryName;
};

struct AuthResult {
    bool success = false;
    std::string token;
    std::string email;
    std::string role;
    std::string errorMessage;
};

class ApiClient {
public:
    ApiClient();
    ~ApiClient();

    // Authenticate with Node.js backend
    AuthResult login(const std::string& baseUrl, const std::string& email, const std::string& password);

    // Catalog fetching
    std::vector<LiveChannel> fetchLiveChannels(const std::string& baseUrl, const std::string& token);
    std::vector<MovieItem> fetchMovies(const std::string& baseUrl, const std::string& token);
    std::vector<SeriesItem> fetchSeries(const std::string& baseUrl, const std::string& token);

    // Generate stream URL with H.264/AAC codec constraints for Nintendo Switch hardware NVDEC
    std::string buildStreamUrl(const std::string& baseUrl, const std::string& type, const std::string& file, const std::string& token);

private:
    CURL* curl;
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp);
    std::string httpGet(const std::string& url, const std::string& token);
    std::string httpPost(const std::string& url, const std::string& jsonBody);
};

} // namespace StreamTV

#endif // API_CLIENT_HPP
