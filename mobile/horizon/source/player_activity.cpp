#include "player_activity.hpp"

namespace StreamTV {

PlayerActivity::PlayerActivity(const std::string& title, const std::string& streamUrl)
    : titleText(title), mediaUrl(streamUrl) {
    setupUI();
    setupControls();
}

PlayerActivity::~PlayerActivity() {}

brls::View* PlayerActivity::create(const std::string& title, const std::string& streamUrl) {
    return new PlayerActivity(title, streamUrl);
}

void PlayerActivity::setupUI() {
    this->setAxis(brls::Axis::VERTICAL);
    this->setJustifyContent(brls::JustifyContent::CENTER);
    this->setAlignItems(brls::AlignItems::CENTER);
    this->setPadding(40);
    this->setBackgroundColor(nvgRGBA(15, 15, 15, 240));

    // Title label
    titleLabel = new brls::Label();
    titleLabel->setText(titleText);
    titleLabel->setFontSize(28);
    titleLabel->setMarginBottom(20);
    titleLabel->setCheckable(false);
    this->addView(titleLabel);

    // Status label showing HLS stream codec constraint (H.264/AAC for Switch NVDEC)
    statusLabel = new brls::Label();
    statusLabel->setText("Cargando Stream (H.264 / AAC HW NVDEC)...");
    statusLabel->setFontSize(18);
    statusLabel->setTextColor(nvgRGBA(229, 9, 20, 255));
    statusLabel->setMarginBottom(30);
    this->addView(statusLabel);

    // Controls hint
    controlsHintLabel = new brls::Label();
    controlsHintLabel->setText("Joy-Con Controles: [A] Pausar/Play  |  [<- / ->] Buscar +-10s  |  [B] Volver");
    controlsHintLabel->setFontSize(16);
    controlsHintLabel->setTextColor(nvgRGBA(180, 180, 180, 255));
    this->addView(controlsHintLabel);
}

void PlayerActivity::setupControls() {
    // Register A button action: Play / Pause
    this->registerAction("Pausar / Reproducir", brls::BUTTON_A, [this](brls::View* view) {
        this->isPlaying = !this->isPlaying;
        if (this->isPlaying) {
            this->statusLabel->setText("Reproduciendo Stream (H.264 / AAC)...");
        } else {
            this->statusLabel->setText("En Pausa");
        }
        return true;
    });

    // Register B button action: Exit Player back to catalog
    this->registerAction("Volver al Catálogo", brls::BUTTON_B, [this](brls::View* view) {
        brls::Application::popView();
        return true;
    });

    // Register D-Pad Left action: Seek -10s
    this->registerAction("Retroceder 10s", brls::BUTTON_LEFT, [this](brls::View* view) {
        this->statusLabel->setText("Retrocediendo -10s...");
        return true;
    });

    // Register D-Pad Right action: Seek +10s
    this->registerAction("Adelantar 10s", brls::BUTTON_RIGHT, [this](brls::View* view) {
        this->statusLabel->setText("Adelantando +10s...");
        return true;
    });
}

} // namespace StreamTV
