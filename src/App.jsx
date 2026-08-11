import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LiveTVSection from './components/LiveTVSection';
import MoviesSection from './components/MoviesSection';
import SeriesSection from './components/SeriesSection';
import MediaPlayer from './components/MediaPlayer';
import ContinueWatching from './components/ContinueWatching';
import { useDPadNavigation } from './hooks/useDPadNavigation';
import { authenticateAccount, getCredentials } from './services/xtream';
import { fetchWatchHistory, saveWatchProgress } from './services/history';
import { Radio, RefreshCw, AlertCircle, Tv, Play, RotateCcw, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'movies' | 'series'
  const [accountInfo, setAccountInfo] = useState(null);
  const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [authError, setAuthError] = useState(null);

  // Active Video Stream State for MediaPlayer
  const [activeStream, setActiveStream] = useState(null);

  // Pending Stream for Resume Modal
  const [pendingResumeStream, setPendingResumeStream] = useState(null);

  // Watch History State for "Continuar Viendo"
  const [historyItems, setHistoryItems] = useState([]);

  // Load Watch History
  const loadHistory = useCallback(async () => {
    const list = await fetchWatchHistory();
    setHistoryItems(list || []);
  }, []);

  // D-Pad Navigation Hook
  const { focusElement } = useDPadNavigation({
    activeZone: activeTab,
    isPlayerOpen: !!activeStream || !!pendingResumeStream,
    onBack: () => {
      if (pendingResumeStream) {
        setPendingResumeStream(null);
      } else if (activeStream) {
        setActiveStream(null);
      }
    },
  });

  // Auto Authenticate on App Mount
  const initAuth = async () => {
    setAuthStatus('loading');
    setAuthError(null);
    try {
      const data = await authenticateAccount();
      if (data && (data.user_info || data.userInfo)) {
        setAccountInfo(data);
        setAuthStatus('success');
        loadHistory();
      } else {
        setAuthStatus('error');
        setAuthError('No se pudo verificar las credenciales del servidor Xtream Codes.');
      }
    } catch (err) {
      setAuthStatus('error');
      setAuthError(err.message || 'Error de conexión con el servidor IPTV.');
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  // Default Focus on Header navigation after load
  useEffect(() => {
    if (authStatus === 'success') {
      setTimeout(() => {
        focusElement(`header-nav-${activeTab}`);
      }, 300);
    }
  }, [authStatus, activeTab, focusElement]);

  // Handle Play Request (Check if saved progress exists)
  const handlePlayRequest = (streamData) => {
    if (streamData.type === 'live') {
      setActiveStream({ ...streamData, initialTime: 0 });
      return;
    }

    const compositeId = `${streamData.type || 'vod'}_${streamData.id}`;
    const saved = historyItems.find(
      (h) => h.id === compositeId || (h.item_id === String(streamData.id) && h.item_type === streamData.type)
    );

    if (saved && saved.progress_seconds > 10) {
      setPendingResumeStream({
        ...streamData,
        savedProgress: saved.progress_seconds,
        duration: saved.duration_seconds,
      });
    } else {
      setActiveStream({ ...streamData, initialTime: 0 });
    }
  };

  const startPlayback = (streamData, startFromBeginning = false) => {
    setActiveStream({
      ...streamData,
      initialTime: startFromBeginning ? 0 : streamData.savedProgress || 0,
    });
    setPendingResumeStream(null);
  };

  const handleProgressUpdate = async (itemData) => {
    await saveWatchProgress(itemData);
    loadHistory();
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const credentials = getCredentials();

  return (
    <div className="h-screen w-screen bg-[#141414] text-white flex flex-col font-['Outfit',sans-serif] overflow-hidden select-none">
      {/* Loading Splash Screen */}
      {authStatus === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 bg-gradient-to-b from-[#141414] to-[#0A0A0A]">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-neutral-900 overflow-hidden border border-neutral-800 flex items-center justify-center shadow-2xl shadow-red-950/80 animate-pulse">
              <img src="/favicon.png" alt="StreamTV Logo" className="w-full h-full object-cover" />
            </div>
            <Radio className="w-6 h-6 text-red-500 absolute -top-2 -right-2 animate-ping" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold tracking-wider">
              Stream<span className="text-red-600">TV</span>
            </h2>
            <p className="text-xs text-neutral-400 font-medium">
              Conectando automáticamente con {credentials.server}...
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
            <span>Cargando contenido IPTV...</span>
          </div>
        </div>
      )}

      {/* Auth Error Screen */}
      {authStatus === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-6 text-center bg-neutral-950">
          <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-white">Error de Conexión IPTV</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">{authError}</p>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-[11px] font-mono text-neutral-400 text-left space-y-1">
              <p>Servidor: {credentials.server}</p>
              <p>Usuario: {credentials.user}</p>
            </div>
          </div>

          <button
            data-dpad-id="auth-retry-btn"
            onClick={initAuth}
            className="dpad-focusable px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar Conexión</span>
          </button>
        </div>
      )}

      {/* Main SPA Application Interface */}
      {authStatus === 'success' && (
        <>
          {/* Header Bar */}
          <Header
            accountInfo={accountInfo}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Main Layout (Sidebar + Content View) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Navigation Sidebar (Desktop Only) */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onRefresh={initAuth}
            />

            {/* Main Content Area: overflow-y-auto allows vertical scrolling on mobile & touch */}
            <main className="flex-1 h-full overflow-y-auto flex flex-col scrollbar-thin">
              {/* Continue Watching Section (Filtered by activeTab) */}
              <ContinueWatching
                historyItems={historyItems}
                activeTab={activeTab}
                onResume={(item) =>
                  setPendingResumeStream({
                    id: item.item_id,
                    type: item.item_type,
                    title: item.title,
                    subtitle: item.subtitle,
                    poster: item.poster,
                    url: item.stream_url,
                    savedProgress: item.progress_seconds,
                    duration: item.duration_seconds,
                  })
                }
              />

              {/* Sections */}
              <div className="flex-1 flex flex-col">
                {activeTab === 'live' && (
                  <LiveTVSection onPlayStream={handlePlayRequest} />
                )}
                {activeTab === 'movies' && (
                  <MoviesSection onPlayStream={handlePlayRequest} />
                )}
                {activeTab === 'series' && (
                  <SeriesSection onPlayStream={handlePlayRequest} />
                )}
              </div>
            </main>
          </div>

          {/* Resume Prompt Modal */}
          {pendingResumeStream && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 select-none animate-fadeIn">
              <div className="glass-panel border border-neutral-700/80 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl relative text-center">
                <button
                  data-dpad-id="resume-modal-close"
                  onClick={() => setPendingResumeStream(null)}
                  className="dpad-focusable absolute top-4 right-4 p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Continuar Reproducción</h3>
                  <p className="text-xs text-neutral-300">
                    Dejaste <span className="text-white font-semibold">"{pendingResumeStream.title}"</span> a medias en el minuto{' '}
                    <span className="text-red-400 font-mono font-bold">{formatTime(pendingResumeStream.savedProgress)}</span>.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    data-dpad-id="resume-btn-continue"
                    onClick={() => startPlayback(pendingResumeStream, false)}
                    className="dpad-focusable w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Reanudar desde {formatTime(pendingResumeStream.savedProgress)}</span>
                  </button>

                  <button
                    data-dpad-id="resume-btn-restart"
                    onClick={() => startPlayback(pendingResumeStream, true)}
                    className="dpad-focusable w-full py-3.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-4 h-4 text-neutral-400" />
                    <span>Empezar desde el inicio</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Video Player Modal */}
          {activeStream && (
            <MediaPlayer
              itemData={activeStream}
              title={activeStream.title}
              subtitle={activeStream.subtitle}
              streamUrl={activeStream.url}
              initialTime={activeStream.initialTime || 0}
              onClose={() => setActiveStream(null)}
              onProgressUpdate={handleProgressUpdate}
            />
          )}
        </>
      )}
    </div>
  );
}
