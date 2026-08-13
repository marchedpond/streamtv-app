//
//  ContentView.swift
//  StreamTV
//

import SwiftUI
import WebKit

struct ContentView: View {
    private let iptvURL = URL(string: "https://streamtv-app.vercel.app/")!

    var body: some View {
        IPTVWebView(url: iptvURL)
            .ignoresSafeArea()
            .background(Color.black)
            #if os(iOS)
            .statusBarHidden(true)
            .persistentSystemOverlays(.hidden)
            .onAppear {
                UIApplication.shared.isIdleTimerDisabled = true
            }
            .onDisappear {
                UIApplication.shared.isIdleTimerDisabled = false
            }
            #endif
    }
}

// MARK: - WKWebView bridge

struct IPTVWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        #if os(iOS)
        configuration.allowsPictureInPictureMediaPlayback = true
        #endif
        configuration.preferences.isElementFullscreenEnabled = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false
        #if os(iOS)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #endif
        webView.isOpaque = false
        #if os(iOS)
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        #endif
        webView.allowsBackForwardNavigationGestures = true

        webView.load(
            URLRequest(
                url: url,
                cachePolicy: .reloadIgnoringLocalCacheData,
                timeoutInterval: 60
            )
        )

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            print("StreamTV load error: \(error.localizedDescription)")
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }
    }
}

#Preview {
    ContentView()
}
