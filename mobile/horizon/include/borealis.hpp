#ifndef BOREALIS_HPP
#define BOREALIS_HPP

#include <string>
#include <vector>
#include <functional>
#include <iostream>

#ifndef NVGcolor
typedef struct {
    float r, g, b, a;
} NVGcolor;

inline NVGcolor nvgRGBA(unsigned char r, unsigned char g, unsigned char b, unsigned char a) {
    NVGcolor color;
    color.r = r / 255.0f;
    color.g = g / 255.0f;
    color.b = b / 255.0f;
    color.a = a / 255.0f;
    return color;
}
#endif

namespace brls {

enum class LogLevel {
    LOG_DEBUG,
    LOG_INFO,
    LOG_WARNING,
    LOG_ERROR
};

class Logger {
public:
    static void setLogLevel(LogLevel level) {}
    static void debug(const std::string& msg) { std::cout << "[DEBUG] " << msg << std::endl; }
    static void info(const std::string& msg) { std::cout << "[INFO] " << msg << std::endl; }
    static void warning(const std::string& msg) { std::cout << "[WARN] " << msg << std::endl; }
    static void error(const std::string& msg) { std::cerr << "[ERROR] " << msg << std::endl; }
};

enum ControllerButton {
    BUTTON_A,
    BUTTON_B,
    BUTTON_X,
    BUTTON_Y,
    BUTTON_UP,
    BUTTON_DOWN,
    BUTTON_LEFT,
    BUTTON_RIGHT,
    BUTTON_START
};

enum class Axis {
    HORIZONTAL,
    VERTICAL
};

enum class JustifyContent {
    START,
    CENTER,
    END,
    SPACE_BETWEEN
};

enum class AlignItems {
    START,
    CENTER,
    END
};

class Event {
public:
    typedef std::function<bool(class View*)> Callback;
    void subscribe(Callback cb) { callback = cb; }
    void fire(class View* view) { if (callback) callback(view); }
private:
    Callback callback;
};

class View {
public:
    virtual ~View() {}
    virtual void setMarginBottom(int margin) {}
    virtual void setPadding(int padding) {}
    virtual void setCheckable(bool checkable) {}
    virtual void setBackgroundColor(NVGcolor color) {}
    Event* getClickEvent() { return &clickEvent; }
private:
    Event clickEvent;
};

class Label : public View {
public:
    Label() {}
    void setText(const std::string& text) { this->text = text; }
    void setFontSize(int size) {}
    void setTextColor(NVGcolor color) {}
private:
    std::string text;
};

class Button : public View {
public:
    Button() {}
    void setText(const std::string& text) { this->text = text; }
private:
    std::string text;
};

class Box : public View {
public:
    Box() {}
    void setAxis(Axis axis) {}
    void setJustifyContent(JustifyContent justify) {}
    void setAlignItems(AlignItems align) {}
    void addView(View* view) { views.push_back(view); }
    typedef std::function<bool(View*)> ActionHandler;
    void registerAction(const std::string& title, ControllerButton button, ActionHandler handler) {}
private:
    std::vector<View*> views;
};

class Grid : public View {
public:
    Grid() {}
    void setColumnsCount(int cols) {}
    void setColumnSpacing(int spacing) {}
    void addView(View* view) { views.push_back(view); }
private:
    std::vector<View*> views;
};

class TabFrame : public View {
public:
    TabFrame() {}
    void setTitle(const std::string& title) {}
    typedef std::function<View*()> TabBuilder;
    void addTab(const std::string& title, TabBuilder builder) {}
};

class Application {
public:
    static bool init(const std::string& title) { return true; }
    static void pushView(View* view) {}
    static void popView() {}
    static bool mainLoop() { return false; } // Exits clean after 1 loop
    static void notify(const std::string& text) { std::cout << "[NOTIFY] " << text << std::endl; }
};

} // namespace brls

#endif // BOREALIS_HPP
