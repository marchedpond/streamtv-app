#ifndef MAIN_ACTIVITY_HPP
#define MAIN_ACTIVITY_HPP

#include <borealis.hpp>
#include "api_client.hpp"
#include <vector>
#include <string>

namespace StreamTV {

class MainActivity : public brls::TabFrame {
public:
    MainActivity(const std::string& baseUrl, const AuthResult& auth);
    ~MainActivity();

private:
    std::string baseUrl;
    AuthResult authInfo;
    ApiClient apiClient;

    brls::View* createLiveTvTab();
    brls::View* createMoviesTab();
    brls::View* createSeriesTab();
};

} // namespace StreamTV

#endif // MAIN_ACTIVITY_HPP
