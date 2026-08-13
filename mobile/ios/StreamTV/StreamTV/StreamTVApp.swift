//
//  StreamTVApp.swift
//  StreamTV
//

import SwiftUI
#if os(iOS)
import AVFoundation
#endif

@main
struct StreamTVApp: App {
    init() {
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .moviePlayback,
                options: [.allowAirPlay]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AVAudioSession error: \(error.localizedDescription)")
        }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
