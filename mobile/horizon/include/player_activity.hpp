#ifndef PLAYER_ACTIVITY_HPP
#define PLAYER_ACTIVITY_HPP

#include <borealis.hpp>
#include <string>

namespace StreamTV {

class PlayerActivity : public brls::Box {
public:
    PlayerActivity(const std::string& title, const std::string& streamUrl);
    ~PlayerActivity();

    static brls::View* create(const std::string& title, const std::string& streamUrl);

private:
    std::string titleText;
    std::string mediaUrl;

    brls::Label* titleLabel;
    brls::Label* statusLabel;
    brls::Label* controlsHintLabel;
    bool isPlaying = true;

    void setupUI();
    void setupControls();
};

} // namespace StreamTV

#endif // PLAYER_ACTIVITY_HPP
