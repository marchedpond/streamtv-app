import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LiveTVSection from './components/LiveTVSection';
import MoviesSection from './components/MoviesSection';
import SeriesSection from './components/SeriesSection';
import MediaPlayer from './components/MediaPlayer';
import ContinueWatching from './components/ContinueWatching';
import Login from './components/Login';
import Register from './components/Register';
import AdminPanel from './components/AdminPanel';
import { useDPadNavigation } from './hooks/useDPadNavigation';
import { authenticateAccount, getLiveStreamUrl } from './services/xtream';
import { fetchWatchHistory, saveWatchProgress } from './services/history';
import { Radio, RefreshCw, AlertCircle, Play, RotateCcw, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'movies' | 'series' | 'admin'
  const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'success' | 'unauthenticated' | 'error'
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [currentUser, setCurrentUser] = useState(null);

  // Active Video Stream State for MediaPlayer
  const [activeStream, setActiveStream] = useState(null);

  // Active Playlist State for sequential channel changes
  const [activePlaylist, setActivePlaylist] = useState([]);
  const [activePlaylistIndex, setActivePlaylistIndex] = useState(-1);

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

  // Verify stored token on app load
  const initAuth = async () => {
    const token = localStorage.getItem('streamtv_token');
    if (!token) {
      setAuthStatus('unauthenticated');
      return;
    }

    setAuthStatus('loading');
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

    try {
      const res = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setAuthStatus('success');
        loadHistory();
      } else if (res.status === 403) {
        setAuthStatus('expired');
      } else {
        localStorage.removeItem('streamtv_token');
        setAuthStatus('unauthenticated');
      }
    } catch (err) {
      setAuthStatus('unauthenticated');
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem('streamtv_token', token);
    setCurrentUser(user);
    setAuthStatus('success');
    loadHistory();
  };

  const handleLogout = () => {
    localStorage.removeItem('streamtv_token');
    setCurrentUser(null);
    setAuthStatus('unauthenticated');
    setActiveTab('live');
  };

  // Default Focus on Header navigation after load & refresh history on tab change
  useEffect(() => {
    if (authStatus === 'success') {
      loadHistory();
      setTimeout(() => {
        focusElement(`header-nav-${activeTab}`);
      }, 300);
    }
  }, [authStatus, activeTab, focusElement, loadHistory]);

  // Handle Play Request (Check if saved progress exists)
  const handlePlayRequest = (streamData, playlist = [], index = -1) => {
    setActivePlaylist(playlist);
    setActivePlaylistIndex(index);

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

  const playPlaylistedItem = (index) => {
    const ch = activePlaylist[index];
    if (!ch) return;
    setActivePlaylistIndex(index);

    if (activeStream?.type === 'live') {
      setActiveStream({
        id: ch.stream_id,
        type: 'live',
        title: ch.name,
        subtitle: `Canal #${ch.num || ch.stream_id}`,
        poster: ch.stream_icon,
        url: getLiveStreamUrl(ch.stream_id),
        initialTime: 0,
      });
    }
  };

  const handleNextTrack = () => {
    if (activePlaylist.length === 0) return;
    const nextIdx = (activePlaylistIndex + 1) % activePlaylist.length;
    playPlaylistedItem(nextIdx);
  };

  const handlePrevTrack = () => {
    if (activePlaylist.length === 0) return;
    const prevIdx = (activePlaylistIndex - 1 + activePlaylist.length) % activePlaylist.length;
    playPlaylistedItem(prevIdx);
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
              Cargando servicio de entretenimiento...
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
            <span>Conectando...</span>
          </div>
        </div>
      )}

      {/* Auth Unauthenticated Screens */}
      {authStatus === 'unauthenticated' && (
        <>
          {authView === 'login' ? (
            <Login
              onLoginSuccess={handleLoginSuccess}
              onGoToRegister={() => setAuthView('register')}
            />
          ) : (
            <Register
              onRegisterSuccess={handleLoginSuccess}
              onGoToLogin={() => setAuthView('login')}
            />
          )}
        </>
      )}

      {/* Auth Expired Screen */}
      {authStatus === 'expired' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-6 text-center bg-[#0A0A0A]">
          <div className="w-16 h-16 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-950/20 animate-pulse">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-3 max-w-md">
            <h2 className="text-2xl font-extrabold text-white tracking-wide">Acceso Vencido</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Tu período de acceso beta o tu suscripción de StreamTV ha caducado. 
              Por favor ponte en contacto con tu administrador familiar para renovar tu tiempo de acceso.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-8 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-bold rounded-2xl text-xs transition cursor-pointer"
          >
            Cerrar Sesión / Cambiar Cuenta
          </button>
        </div>
      )}

      {/* Auth Error Screen */}
      {authStatus === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-6 text-center bg-neutral-950">
          <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-500 shadow-xl shadow-red-950/50">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-3 max-w-md">
            <h2 className="text-2xl font-extrabold text-white tracking-wide">Servicio No Disponible</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              No se pudo establecer conexión con el catálogo de televisión.
              Por favor verifica tu conexión a internet o reintenta en unos momentos.
            </p>
          </div>

          <button
            data-dpad-id="auth-retry-btn"
            onClick={initAuth}
            className="dpad-focusable px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-lg shadow-red-950/80 cursor-pointer transform hover:scale-105"
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
            accountInfo={null}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={currentUser}
            onLogout={handleLogout}
          />

          {/* Main Layout (Sidebar + Content View) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Navigation Sidebar (Desktop Only) */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onRefresh={initAuth}
              user={currentUser}
              onLogout={handleLogout}
            />

            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-y-auto flex flex-col scrollbar-thin">
              {/* Continue Watching Section (Filtered by activeTab) */}
              {activeTab !== 'admin' && (
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
              )}

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
                {activeTab === 'admin' && (
                  <AdminPanel />
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
              onClose={() => {
                setActiveStream(null);
                loadHistory();
              }}
              onProgressUpdate={handleProgressUpdate}
              onNextTrack={activePlaylist.length > 0 ? handleNextTrack : null}
              onPrevTrack={activePlaylist.length > 0 ? handlePrevTrack : null}
            />
          )}
        </>
      )}
    </div>
  );
}
