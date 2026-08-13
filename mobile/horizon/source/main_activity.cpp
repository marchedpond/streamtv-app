#include "main_activity.hpp"
#include "player_activity.hpp"
#include <iostream>

namespace StreamTV {

MainActivity::MainActivity(const std::string& baseUrl, const AuthResult& auth)
    : baseUrl(baseUrl), authInfo(auth) {

    this->setTitle("StreamTV — Nintendo Switch Edition");

    // Add Tab 1: Live TV
    this->addTab("TV en Vivo", [this]() {
        return this->createLiveTvTab();
    });

    // Add Tab 2: Movies
    this->addTab("Películas", [this]() {
        return this->createMoviesTab();
    });

    // Add Tab 3: Series
    this->addTab("Series", [this]() {
        return this->createSeriesTab();
    });
}

MainActivity::~MainActivity() {}

brls::View* MainActivity::createLiveTvTab() {
    brls::Box* container = new brls::Box();
    container->setAxis(brls::Axis::VERTICAL);
    container->setPadding(20);

    brls::Label* headerLabel = new brls::Label();
    headerLabel->setText("Canales de Televisión en Vivo");
    headerLabel->setFontSize(22);
    headerLabel->setMarginBottom(15);
    container->addView(headerLabel);

    auto channels = apiClient.fetchLiveChannels(baseUrl, authInfo.token);

    if (channels.empty()) {
        brls::Label* emptyLabel = new brls::Label();
        emptyLabel->setText("Cargando lista de canales o conectando al servidor...");
        emptyLabel->setFontSize(16);
        emptyLabel->setTextColor(nvgRGBA(160, 160, 160, 255));
        container->addView(emptyLabel);
    } else {
        brls::Grid* grid = new brls::Grid();
        grid->setColumnsCount(3);
        grid->setColumnSpacing(15);

        for (const auto& ch : channels) {
            brls::Button* btn = new brls::Button();
            btn->setText(ch.name);

            std::string streamUrl = apiClient.buildStreamUrl(baseUrl, "live", ch.streamId + ".m3u8", authInfo.token);
            std::string chName = ch.name;

            btn->getClickEvent()->subscribe([chName, streamUrl](brls::View* view) -> bool {
                brls::Application::pushView(PlayerActivity::create(chName, streamUrl));
                return true;
            });

            grid->addView(btn);
        }
        container->addView(grid);
    }

    return container;
}

brls::View* MainActivity::createMoviesTab() {
    brls::Box* container = new brls::Box();
    container->setAxis(brls::Axis::VERTICAL);
    container->setPadding(20);

    brls::Label* headerLabel = new brls::Label();
    headerLabel->setText("Catálogo de Películas VOD");
    headerLabel->setFontSize(22);
    headerLabel->setMarginBottom(15);
    container->addView(headerLabel);

    auto movies = apiClient.fetchMovies(baseUrl, authInfo.token);

    if (movies.empty()) {
        brls::Label* emptyLabel = new brls::Label();
        emptyLabel->setText("Cargando catálogo de películas...");
        emptyLabel->setFontSize(16);
        emptyLabel->setTextColor(nvgRGBA(160, 160, 160, 255));
        container->addView(emptyLabel);
    } else {
        brls::Grid* grid = new brls::Grid();
        grid->setColumnsCount(3);
        grid->setColumnSpacing(15);

        for (const auto& m : movies) {
            brls::Button* btn = new brls::Button();
            std::string labelText = m.title + " (" + (m.year.empty() ? "HD" : m.year) + ")";
            btn->setText(labelText);

            std::string ext = m.containerExtension.empty() ? "mp4" : m.containerExtension;
            std::string streamUrl = apiClient.buildStreamUrl(baseUrl, "movie", m.streamId + "." + ext, authInfo.token);
            std::string movieTitle = m.title;

            btn->getClickEvent()->subscribe([movieTitle, streamUrl](brls::View* view) -> bool {
                brls::Application::pushView(PlayerActivity::create(movieTitle, streamUrl));
                return true;
            });

            grid->addView(btn);
        }
        container->addView(grid);
    }

    return container;
}

brls::View* MainActivity::createSeriesTab() {
    brls::Box* container = new brls::Box();
    container->setAxis(brls::Axis::VERTICAL);
    container->setPadding(20);

    brls::Label* headerLabel = new brls::Label();
    headerLabel->setText("Catálogo de Series");
    headerLabel->setFontSize(22);
    headerLabel->setMarginBottom(15);
    container->addView(headerLabel);

    auto seriesList = apiClient.fetchSeries(baseUrl, authInfo.token);

    if (seriesList.empty()) {
        brls::Label* emptyLabel = new brls::Label();
        emptyLabel->setText("Cargando catálogo de series...");
        emptyLabel->setFontSize(16);
        emptyLabel->setTextColor(nvgRGBA(160, 160, 160, 255));
        container->addView(emptyLabel);
    } else {
        brls::Grid* grid = new brls::Grid();
        grid->setColumnsCount(3);
        grid->setColumnSpacing(15);

        for (const auto& s : seriesList) {
            brls::Button* btn = new brls::Button();
            btn->setText(s.title);

            std::string seriesTitle = s.title;
            btn->getClickEvent()->subscribe([seriesTitle](brls::View* view) -> bool {
                brls::Application::notify("Serie seleccionada: " + seriesTitle);
                return true;
            });

            grid->addView(btn);
        }
        container->addView(grid);
    }

    return container;
}

} // namespace StreamTV
