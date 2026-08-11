import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, ArrowLeft, Tv, AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function MediaPlayer({
  itemData,
  title,
  subtitle,
  streamUrl,
  initialTime = 0,
  onClose,
  onProgressUpdate,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const controlsTimeoutRef = useRef(null);
  const lastSavedTimeRef = useRef(0);

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  useEffect(() => {
    handleUserActivity();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Helper to send progress to history service
  const triggerSaveProgress = useCallback(
    (curr, dur) => {
      if (!onProgressUpdate) return;
      if (curr < 2) return; // Skip saving first 2 seconds

      onProgressUpdate({
        item_id: itemData?.id || itemData?.stream_id || title,
        item_type: itemData?.type || 'vod',
        title: title || itemData?.title || 'Video',
        subtitle: subtitle || itemData?.subtitle || '',
        poster: itemData?.poster || itemData?.stream_icon || '',
        stream_url: streamUrl,
        progress_seconds: Math.floor(curr),
        duration_seconds: Math.floor(dur || 0),
      });
    },
    [itemData, title, subtitle, streamUrl, onProgressUpdate]
  );

  // Manual Retry Handler
  const handleManualRetry = () => {
    setErrorMsg(null);
    setIsLoadingVideo(true);
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsLoadingVideo(false)).catch(() => {});
    }
  };

  // Initialize Video & Hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setErrorMsg(null);
    setIsLoadingVideo(true);
    setRetryCount(0);

    const isHlsStream = streamUrl.includes('.m3u8') || streamUrl.includes('/live/');

    const seekToInitial = () => {
      if (initialTime > 5 && video.duration && initialTime < video.duration - 10) {
        video.currentTime = initialTime;
      }
    };

    // If stream URL is HTTP and running on HTTPS (Vercel), proxy via /api_raw_proxy
    let effectiveStreamUrl = streamUrl;
    if (window.location.protocol === 'https:' && streamUrl.startsWith('http:')) {
      effectiveStreamUrl = `/api_raw_proxy?url=${encodeURIComponent(streamUrl)}`;
    }

    if (isHlsStream && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferHole: 0.5,
        // Intercept all HTTP segment requests on HTTPS pages to prevent Mixed Content errors
        xhrSetup: (xhr, url) => {
          if (window.location.protocol === 'https:' && url.startsWith('http:')) {
            const proxyUrl = `/api_raw_proxy?url=${encodeURIComponent(url)}`;
            xhr.open('GET', proxyUrl, true);
          }
        },
      });

      hlsRef.current = hls;
      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        seekToInitial();
        video.play().then(() => setIsLoadingVideo(false)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Auto retry up to 3 times before displaying non-blocking error toast
              if (retryCount < 3) {
                setRetryCount((prev) => prev + 1);
                hls.startLoad();
              } else {
                setErrorMsg('Conexión inestable con el servidor de la señal.');
                setIsLoadingVideo(false);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setErrorMsg('Ocurrió una interrupción temporal en la señal.');
              setIsLoadingVideo(false);
              hls.destroy();
              break;
          }
        }
      });
    } else {
      video.src = effectiveStreamUrl;
      video.addEventListener('loadedmetadata', seekToInitial, { once: true });
      video.play().then(() => setIsLoadingVideo(false)).catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, initialTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerSaveProgress(videoRef.current.currentTime, videoRef.current.duration);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seek = (seconds) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    triggerSaveProgress(newTime, videoRef.current.duration);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration;

    if (curr > 0 && isLoadingVideo) {
      setIsLoadingVideo(false);
    }

    setCurrentTime(curr);
    setDuration(dur || 0);
    setProgress(dur ? (curr / dur) * 100 : 0);

    // Save progress throttled every 25 seconds to minimize Neon DB compute hours
    if (Math.abs(curr - lastSavedTimeRef.current) >= 25) {
      lastSavedTimeRef.current = curr;
      triggerSaveProgress(curr, dur);
    }
  };

  const handleClose = () => {
    if (videoRef.current) {
      triggerSaveProgress(videoRef.current.currentTime, videoRef.current.duration);
    }
    onClose();
  };

  // Keyboard / Remote D-Pad Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      handleUserActivity();
      switch (e.key) {
        case ' ':
        case 'Enter':
          if (document.activeElement === videoRef.current || document.activeElement === containerRef.current) {
            e.preventDefault();
            togglePlay();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(10);
          break;
        case 'ArrowUp':
          if (videoRef.current) {
            e.preventDefault();
            videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          }
          break;
        case 'ArrowDown':
          if (videoRef.current) {
            e.preventDefault();
            videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          handleClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, onClose]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden font-['Outfit'] select-none"
    >
      {/* HTML5 Video Element with referrerPolicy="no-referrer" */}
      <video
        ref={videoRef}
        referrerPolicy="no-referrer"
        onTimeUpdate={handleTimeUpdate}
        onPlaying={() => setIsLoadingVideo(false)}
        onCanPlay={() => setIsLoadingVideo(false)}
        onLoadedData={() => setIsLoadingVideo(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (videoRef.current) triggerSaveProgress(videoRef.current.currentTime, videoRef.current.duration);
        }}
        onError={() => {
          setIsLoadingVideo(false);
          setErrorMsg('Reconectando señal de transmisión...');
        }}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
      />

      {/* Video Loading Animation Overlay */}
      {isLoadingVideo && !errorMsg && (
        <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center space-y-6 z-40 transition-opacity duration-500">
          {/* Top-Left Close Button during Loading */}
          <button
            data-dpad-id="player-loading-close"
            onClick={handleClose}
            className="dpad-focusable absolute top-6 left-6 p-3 rounded-full bg-neutral-900/90 hover:bg-red-600 text-white transition-all cursor-pointer border border-neutral-700 z-50 flex items-center gap-2 text-xs font-semibold shadow-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Cancelar y Volver</span>
          </button>

          <div className="relative flex items-center justify-center">
            {/* Animated Pulsing Ring */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />

            {/* Center Brand Icon */}
            <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden flex items-center justify-center shadow-2xl shadow-red-950/80">
              <img src="/favicon.png" alt="StreamTV Logo" className="w-full h-full object-cover animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-1.5 max-w-sm px-4">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
              {title || 'Cargando Transmisión...'}
            </h3>
            {subtitle && <p className="text-xs text-red-400 font-medium truncate">{subtitle}</p>}
            <p className="text-[11px] text-neutral-400 animate-pulse pt-1">
              Preparando transmisión HD y buffering...
            </p>
          </div>

          <button
            data-dpad-id="player-loading-cancel-btn"
            onClick={handleClose}
            className="dpad-focusable px-6 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition cursor-pointer"
          >
            Cancelar Reproducción
          </button>
        </div>
      )}

      {/* Non-Blocking Floating Error / Reconnect Toast Banner (Top Center) */}
      {errorMsg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-red-800/80 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl shadow-black animate-fadeIn select-none max-w-md">
          <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-white leading-tight">Interrupción Temporal</p>
            <p className="text-[11px] text-neutral-400 truncate">{errorMsg}</p>
          </div>
          <button
            data-dpad-id="player-toast-retry"
            onClick={handleManualRetry}
            className="dpad-focusable px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
          <button
            data-dpad-id="player-toast-dismiss"
            onClick={() => setErrorMsg(null)}
            className="dpad-focusable p-1 text-neutral-400 hover:text-white transition cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controller Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/80 flex flex-col justify-between p-6 sm:p-8 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Bar: Title & Back */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-dpad-id="player-btn-back"
              onClick={handleClose}
              className="dpad-focusable p-3 rounded-full bg-neutral-900/80 hover:bg-red-600 text-white transition-all cursor-pointer border border-neutral-700"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">{title || 'Transmisión IPTV'}</h2>
              {subtitle && <p className="text-xs text-red-400 font-medium">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-full text-xs font-semibold text-neutral-300">
            <Tv className="w-4 h-4 text-red-500" />
            <span>StreamTV Player</span>
          </div>
        </div>

        {/* Bottom Bar: Timeline & Controls */}
        <div className="space-y-4">
          {/* Seek Progress Bar if Duration available */}
          {duration > 0 && (
            <div className="space-y-1">
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden relative cursor-pointer">
                <div
                  className="bg-red-600 h-full rounded-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-400 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                data-dpad-id="player-btn-play"
                onClick={togglePlay}
                className="dpad-focusable p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer shadow-lg shadow-red-950/60"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
              </button>

              <button
                data-dpad-id="player-btn-rewind"
                onClick={() => seek(-10)}
                className="dpad-focusable p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-all cursor-pointer border border-neutral-800"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                data-dpad-id="player-btn-forward"
                onClick={() => seek(10)}
                className="dpad-focusable p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-all cursor-pointer border border-neutral-800"
              >
                <RotateCw className="w-5 h-5" />
              </button>

              <button
                data-dpad-id="player-btn-mute"
                onClick={toggleMute}
                className="dpad-focusable p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-all cursor-pointer border border-neutral-800"
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                data-dpad-id="player-btn-fullscreen"
                onClick={toggleFullscreen}
                className="dpad-focusable p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 transition-all cursor-pointer border border-neutral-800"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
