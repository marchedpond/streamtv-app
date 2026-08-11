import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, Tv, AlertTriangle, RefreshCw, X, Languages, Check, PictureInPicture, SkipBack, SkipForward } from 'lucide-react';

const Rewind10Icon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a9 9 0 1 0 7 3.5" />
    <polyline points="12 1 8 4 12 7" />
    <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="currentColor" stroke="none" fontFamily="sans-serif">-10</text>
  </svg>
);

const Forward10Icon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a9 9 0 1 1 -7 3.5" />
    <polyline points="12 1 16 4 12 7" />
    <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="currentColor" stroke="none" fontFamily="sans-serif">+10</text>
  </svg>
);

export default function MediaPlayer({
  itemData,
  title,
  subtitle,
  streamUrl,
  initialTime = 0,
  onClose,
  onProgressUpdate,
  onNextTrack,
  onPrevTrack,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const triggerSilentReloadRef = useRef(null);
  const isLive = itemData?.type === 'live';

  // Seek Ripple Animation State
  const [seekFeedback, setSeekFeedback] = useState(null);
  const seekFeedbackTimeoutRef = useRef(null);

  // Audio & Subtitle Tracks State
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
  const [showAudioSubMenu, setShowAudioSubMenu] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState('audio');

  // Proxy Subtitle Tracks for VOD/Series
  const [proxySubtitleTracks, setProxySubtitleTracks] = useState([]);
  const [trackTransition, setTrackTransition] = useState(null);

  useEffect(() => {
    let active = true;
    if (itemData && (itemData.type === 'vod' || itemData.type === 'series')) {
      const streamId = itemData.id;
      const streamType = itemData.type;
      const containerExt = itemData.container_extension || 'mkv';

      fetch(`/api_subtitles?id=${streamId}&type=${streamType}&action=tracks&ext=${containerExt}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (active) {
            setProxySubtitleTracks(data);
          }
        })
        .catch((err) => {
          console.error('Error fetching proxy subtitles:', err);
          if (active) setProxySubtitleTracks([]);
        });
    } else {
      setProxySubtitleTracks([]);
    }

    return () => {
      active = false;
    };
  }, [itemData]);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const controlsTimeoutRef = useRef(null);
  const lastSavedTimeRef = useRef(0);

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showAudioSubMenu) {
        setShowControls(false);
      }
    }, 4500);
  };

  useEffect(() => {
    handleUserActivity();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showAudioSubMenu]);

  // Helper to send progress to history service
  const triggerSaveProgress = useCallback(
    (curr, dur) => {
      if (!onProgressUpdate) return;
      if (curr < 2) return;

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

  // Picture-in-Picture (PiP) Toggle Handler
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('Picture-in-Picture error:', err);
    }
  };

  // Volume Slider Handler
  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  // Switch Audio Track
  const handleSelectAudioTrack = (trackId) => {
    const track = audioTracks.find(t => t.id === trackId);
    const trackName = track ? track.name : `Pista ${trackId + 1}`;

    const video = videoRef.current;
    let wasPlaying = isPlaying;
    if (video) {
      video.pause();
    }
    setIsPlaying(false);

    setTrackTransition({ type: 'audio', name: trackName });

    setSelectedAudioTrack(trackId);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
    } else if (video && video.audioTracks) {
      Array.from(video.audioTracks).forEach((t, idx) => {
        t.enabled = idx === trackId;
      });
    }

    setTimeout(() => {
      setTrackTransition(null);
      if (video && wasPlaying) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }, 1200);
  };

  // Sync Audio and Subtitle tracks from Hls.js and native video element
  const syncTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      const hls = hlsRef.current;

      // Sync Audio Tracks
      if (hls.audioTracks && hls.audioTracks.length > 0) {
        const formattedAudio = hls.audioTracks.map((t) => ({
          id: t.id,
          name: t.name || (t.lang ? `Audio (${t.lang.toUpperCase()})` : `Pista de Audio ${t.id + 1}`),
          lang: t.lang || '',
        }));
        setAudioTracks(formattedAudio);
        setSelectedAudioTrack(hls.audioTrack);
      }

      // Sync Subtitle Tracks (merge HLS.js tracks and native textTracks if any)
      let formattedSubs = [];
      if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
        formattedSubs = hls.subtitleTracks.map((t) => ({
          id: t.id,
          name: t.name || (t.lang ? `Subtítulo (${t.lang.toUpperCase()})` : `Subtítulo ${t.id + 1}`),
          lang: t.lang || '',
        }));
      }

      // Read native subtitle tracks from the video element and merge
      if (video.textTracks && video.textTracks.length > 0) {
        const subTracks = Array.from(video.textTracks).filter(
          (t) => t.kind === 'subtitles' || t.kind === 'captions'
        );
        subTracks.forEach((t, idx) => {
          const lang = t.language || '';
          const name = t.label || (t.language ? `Subtítulo (${t.language.toUpperCase()})` : `Subtítulo ${idx + 1}`);
          // Prevent duplicates by comparing name & language
          const exists = formattedSubs.some(
            (fs) => fs.lang.toLowerCase() === lang.toLowerCase() && fs.name.toLowerCase() === name.toLowerCase()
          );
          if (!exists) {
            formattedSubs.push({
              id: `native-${idx}`,
              name,
              lang,
              isNative: true,
              trackRef: t,
            });
          }
        });
      }

      setSubtitleTracks(formattedSubs);

      // Resolve selected subtitle index
      if (hls.subtitleTrack >= 0) {
        setSelectedSubtitleTrack(hls.subtitleTrack);
      } else {
        const nativeActiveIdx = formattedSubs.findIndex((t) => t.isNative && t.trackRef.mode === 'showing');
        if (nativeActiveIdx >= 0) {
          setSelectedSubtitleTrack(formattedSubs[nativeActiveIdx].id);
        } else {
          setSelectedSubtitleTrack(-1);
        }
      }
      return;
    }

    // Native Video Element fallback (Safari native HLS or direct MP4/MKV)
    if (video.audioTracks && video.audioTracks.length > 0) {
      const tracks = Array.from(video.audioTracks).map((t, idx) => ({
        id: idx,
        name: t.label || (t.language ? `Audio (${t.language.toUpperCase()})` : `Pista de Audio ${idx + 1}`),
        lang: t.language || '',
      }));
      setAudioTracks(tracks);
      const activeIdx = Array.from(video.audioTracks).findIndex((t) => t.enabled);
      setSelectedAudioTrack(activeIdx >= 0 ? activeIdx : 0);
    }

    if (video.textTracks && video.textTracks.length > 0) {
      const subTracks = Array.from(video.textTracks).filter(
        (t) => t.kind === 'subtitles' || t.kind === 'captions'
      );
      const tracks = subTracks.map((t, idx) => ({
        id: idx,
        name: t.label || (t.language ? `Subtítulo (${t.language.toUpperCase()})` : `Subtítulo ${idx + 1}`),
        lang: t.language || '',
      }));
      setSubtitleTracks(tracks);
      const activeIdx = subTracks.findIndex((t) => t.mode === 'showing');
      setSelectedSubtitleTrack(activeIdx);
    }
  }, []);

  // Switch Subtitle Track
  const handleSelectSubtitleTrack = (trackId) => {
    let trackName = 'Desactivados';
    if (trackId !== -1) {
      const track = subtitleTracks.find(t => t.id === trackId);
      trackName = track ? track.name : 'Activados';
    }

    const video = videoRef.current;
    let wasPlaying = isPlaying;
    if (video) {
      video.pause();
    }
    setIsPlaying(false);

    setTrackTransition({ type: 'subtitle', name: trackName });

    setSelectedSubtitleTrack(trackId);

    if (video && video.textTracks) {
      // Disable all native tracks to prevent overlap
      Array.from(video.textTracks).forEach((t) => {
        t.mode = 'disabled';
      });
    }

    if (hlsRef.current) {
      if (typeof trackId === 'string' && trackId.startsWith('native-')) {
        hlsRef.current.subtitleTrack = -1; // Disable Hls.js subtitle rendering
        const idx = parseInt(trackId.replace('native-', ''), 10);
        if (video && video.textTracks) {
          const subTracks = Array.from(video.textTracks).filter(
            (t) => t.kind === 'subtitles' || t.kind === 'captions'
          );
          if (subTracks[idx]) {
            subTracks[idx].mode = 'showing';
          }
        }
      } else if (trackId === -1) {
        hlsRef.current.subtitleTrack = -1;
      } else {
        // Switch using Hls.js subtitle track
        hlsRef.current.subtitleTrack = typeof trackId === 'number' ? trackId : parseInt(trackId, 10);
      }
    } else if (video && video.textTracks) {
      const idx = typeof trackId === 'number' ? trackId : parseInt(trackId, 10);
      const subTracks = Array.from(video.textTracks).filter(
        (t) => t.kind === 'subtitles' || t.kind === 'captions'
      );
      if (subTracks[idx]) {
        subTracks[idx].mode = 'showing';
      }
    }

    setTimeout(() => {
      setTrackTransition(null);
      if (video && wasPlaying) {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }, 1200);
  };

  // Sync Native Video Audio & Subtitle Tracks
  const setupNativeTrackListeners = (video) => {
    if (!video) return;

    if (video.audioTracks) {
      video.audioTracks.addEventListener('addtrack', syncTracks);
      video.audioTracks.addEventListener('removetrack', syncTracks);
      video.audioTracks.addEventListener('change', syncTracks);
    }

    if (video.textTracks) {
      video.textTracks.addEventListener('addtrack', syncTracks);
      video.textTracks.addEventListener('removetrack', syncTracks);
      video.textTracks.addEventListener('change', syncTracks);

      // Sanitize cue text for all text tracks to fix \N ASS override codes
      const sanitizeCues = (track) => {
        if (!track.cues) return;
        Array.from(track.cues).forEach((cue) => {
          if (cue.text && /\\[Nn]/.test(cue.text)) {
            cue.text = cue.text.replace(/\\[Nn]/g, '\n');
          }
        });
      };

      const handleAddTrack = (e) => {
        const track = e.track;
        // Sanitize existing cues when track loads
        track.addEventListener('cuechange', () => sanitizeCues(track));
        // Also sanitize when all cues load
        if (track.cues && track.cues.length > 0) sanitizeCues(track);
      };

      video.textTracks.addEventListener('addtrack', handleAddTrack);
    }
  };

  // Persist subtitle selection — reapply track mode whenever selectedSubtitleTrack changes
  // This prevents HLS.js internal resets from clearing user selection
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    if (selectedSubtitleTrack === -1 || subtitleTracks.length === 0) return;

    const trackInfo = typeof selectedSubtitleTrack === 'string' && selectedSubtitleTrack.startsWith('native-')
      ? subtitleTracks.find(t => t.id === selectedSubtitleTrack)
      : null;

    if (trackInfo) {
      Array.from(video.textTracks).forEach((t) => {
        if (
          (t.kind === 'subtitles' || t.kind === 'captions') &&
          t.label === trackInfo.name &&
          (t.language === trackInfo.lang || !trackInfo.lang)
        ) {
          if (t.mode !== 'showing') t.mode = 'showing';
        }
      });
    }
  }, [selectedSubtitleTrack, subtitleTracks]);

  // MediaSession API Integration for Background & Lock Screen Playback
  useEffect(() => {
    if ('mediaSession' in navigator && title) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'StreamTV Transmisión',
        artist: subtitle || 'StreamTV IPTV',
        album: 'StreamTV Player',
        artwork: [
          { src: itemData?.poster || itemData?.stream_icon || '/favicon.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          if (videoRef.current) videoRef.current.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (videoRef.current) videoRef.current.pause();
        });
        navigator.mediaSession.setActionHandler('seekbackward', () => {
          seek(-10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
          seek(10);
        });
      } catch (e) {
        // Fallback for browsers with partial MediaSession support
      }
    }
  }, [title, subtitle, itemData]);

  // Initialize Video & Hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setErrorMsg(null);
    setIsLoadingVideo(true);
    setIsBuffering(false);
    setRetryCount(0);
    setAudioTracks([]);
    setSubtitleTracks([]);
    setSelectedAudioTrack(-1);
    setSelectedSubtitleTrack(-1);

    const isHlsStream = streamUrl.includes('.m3u8') || streamUrl.includes('/live/');

    const seekToInitial = () => {
      if (initialTime > 5 && video.duration && initialTime < video.duration - 10) {
        video.currentTime = initialTime;
      }
    };

    let effectiveStreamUrl = streamUrl;
    if (window.location.protocol === 'https:' && streamUrl.startsWith('http:')) {
      effectiveStreamUrl = `/api_raw_proxy?url=${encodeURIComponent(streamUrl)}`;
    }

    setupNativeTrackListeners(video);

    // Optimized HLS Config for high resilience on throttled/corporate firewalls
    const hlsConfig = {
      enableWorker: true,
      lowLatencyMode: false, // Prioritize robust buffer size over sub-second latency
      backBufferLength: 90,
      maxBufferLength: 60,   // Store up to 60 seconds of video fragments
      maxMaxBufferLength: 120, // Absolute max buffer limit
      maxBufferSize: 120 * 1024 * 1024, // Up to 120MB buffer space (default 60MB)
      maxBufferHole: 2.0,    // Jump over up to 2s gaps instead of stalling or dropping frames
      maxAudioFramesDrift: 3.0, // Tolerates timestamp drift to fix stuttering audio

      // Live TV buffer settings to prevent playing too close to empty edge
      liveSyncDurationCount: 7, // 7 segments behind live edge to prevent dry buffer states
      liveMaxLatencyDurationCount: 14,
      nudgeMaxRetries: 10,   // Increase nudge retries for timestamp gaps
      nudgeDelay: 0.2,       // Slow down nudging to let decoder stabilize

      // Frag / Manifest Timeouts & Retry Delays
      fragLoadingTimeOut: 15000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 1000,
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 8,
      manifestLoadingRetryDelay: 1000,
      levelLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 8,
      levelLoadingRetryDelay: 1000,

      xhrSetup: (xhr, url) => {
        if (window.location.protocol === 'https:' && url.startsWith('http:')) {
          const proxyUrl = `/api_raw_proxy?url=${encodeURIComponent(url)}`;
          xhr.open('GET', proxyUrl, true);
        }
      },
    };

    let networkErrorCount = 0;
    let mediaErrorCount = 0;
    let silentReloadsInWindow = 0;
    let lastReloadTime = 0;

    const performSilentReload = () => {
      if (!video || !hlsRef.current) return;

      const now = Date.now();
      if (now - lastReloadTime < 25000) {
        silentReloadsInWindow++;
      } else {
        silentReloadsInWindow = 1;
      }
      lastReloadTime = now;

      if (silentReloadsInWindow > 3) {
        console.error('Too many silent reloads within 25 seconds. Suspending auto-reconnection.');
        setErrorMsg('Conexión inestable con el servidor multimedia. Por favor, intente de nuevo.');
        setIsLoadingVideo(false);
        setIsBuffering(false);
        return;
      }

      const currentTimeBeforeReload = video.currentTime;
      console.log(`[Resilience] Performing silent rebuild of HLS.js at position ${currentTimeBeforeReload}s...`);
      setIsBuffering(true);

      // Destroy current instance
      hlsRef.current.destroy();

      // Create new instance
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);

      hls.once(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[Resilience] Manifest parsed after silent rebuild, resuming at ${currentTimeBeforeReload}s...`);
        video.currentTime = currentTimeBeforeReload;
        video.play()
          .then(() => {
            setIsLoadingVideo(false);
            setIsBuffering(false);
          })
          .catch(() => {
            setIsPlaying(false);
            setIsBuffering(false);
          });
      });

      setupHlsEvents(hls);
    };

    // Expose reload function to outside effects (like watchdog) via ref
    triggerSilentReloadRef.current = performSilentReload;

    const setupHlsEvents = (hlsInstance) => {
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        seekToInitial();
        video.play()
          .then(() => {
            setIsLoadingVideo(false);
            setIsBuffering(false);
          })
          .catch(() => {
            setIsPlaying(false);
            setIsLoadingVideo(false);
          });
        syncTracks();
      });

      hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        syncTracks();
      });

      hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        syncTracks();
      });

      // Sanitize \N ASS override codes in HLS.js delivered subtitle cues
      hlsInstance.on(Hls.Events.SUBTITLE_FRAG_PROCESSED, () => {
        if (!video.textTracks) return;
        Array.from(video.textTracks).forEach((track) => {
          if (!track.cues) return;
          Array.from(track.cues).forEach((cue) => {
            if (cue.text && /\\[Nn]/.test(cue.text)) {
              cue.text = cue.text.replace(/\\[Nn]/g, '\n');
            }
          });
        });
      });

      hlsInstance.on(Hls.Events.LEVEL_LOADED, () => {
        syncTracks();
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkErrorCount < 5) {
                networkErrorCount++;
                console.warn(`[Resilience] Fatal Network Error. Retrying Hls.startLoad() (${networkErrorCount}/5)...`, data);
                hlsInstance.startLoad();
              } else {
                console.warn('[Resilience] Fatal Network Error limit reached. Initiating silent rebuild...', data);
                networkErrorCount = 0;
                performSilentReload();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaErrorCount < 3) {
                mediaErrorCount++;
                console.warn(`[Resilience] Fatal Media Error. Retrying Hls.recoverMediaError() (${mediaErrorCount}/3)...`, data);
                hlsInstance.recoverMediaError();
              } else {
                console.warn('[Resilience] Media Error limit reached. Swapping audio codec and recovering...', data);
                hlsInstance.swapAudioCodec();
                hlsInstance.recoverMediaError();
                mediaErrorCount = 0;
              }
              break;
            default:
              console.error('[Resilience] Fatal unrecoverable HLS error. Performing silent rebuild...', data);
              performSilentReload();
              break;
          }
        }
      });
    };

    if (isHlsStream && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);
      setupHlsEvents(hls);
    } else {
      video.src = effectiveStreamUrl;
      video.addEventListener('loadedmetadata', seekToInitial, { once: true });
      video.play()
        .then(() => {
          setIsLoadingVideo(false);
          setIsBuffering(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsLoadingVideo(false);
        });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      triggerSilentReloadRef.current = null;
    };
  }, [streamUrl, initialTime]);

  // Watchdog para detectar bloqueos (stalling) en buffering superior a 15 segundos
  useEffect(() => {
    let stallTimeout = null;

    if (isBuffering && isPlaying && !isLoadingVideo && !errorMsg) {
      console.log('[Resilience] Player in buffering state. Starting 15s stall watchdog...');
      stallTimeout = setTimeout(() => {
        if (triggerSilentReloadRef.current) {
          console.warn('[Resilience] Buffering stalled for 15s. Triggering automatic reconnect...');
          triggerSilentReloadRef.current();
        }
      }, 15000);
    }

    return () => {
      if (stallTimeout) {
        clearTimeout(stallTimeout);
      }
    };
  }, [isBuffering, isPlaying, isLoadingVideo, errorMsg]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerSaveProgress(videoRef.current.currentTime, videoRef.current.duration);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const seek = (seconds) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    triggerSaveProgress(newTime, videoRef.current.duration);

    // Trigger Screen Ripple Animation Feedback
    const type = seconds < 0 ? 'rewind' : 'forward';
    const label = seconds < 0 ? `${seconds}s` : `+${seconds}s`;
    setSeekFeedback({ type, label, id: Date.now() });

    if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
    seekFeedbackTimeoutRef.current = setTimeout(() => {
      setSeekFeedback(null);
    }, 750);
  };

  const handleTimelineSeek = (e) => {
    const targetTime = parseFloat(e.target.value);
    if (!videoRef.current || isNaN(targetTime)) return;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setProgress(duration ? (targetTime / duration) * 100 : 0);
    triggerSaveProgress(targetTime, duration);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuteState = !isMuted;
    videoRef.current.muted = newMuteState;
    setIsMuted(newMuteState);
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

    if (Math.abs(curr - lastSavedTimeRef.current) >= 10) {
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
          {
            const activeId = document.activeElement?.getAttribute('data-dpad-id');
            const isButtonFocused = activeId && activeId !== 'player-timeline-slider';
            if (!isButtonFocused) {
              e.preventDefault();
              if (isLive) {
                if (onPrevTrack) onPrevTrack();
              } else {
                seek(-10);
              }
            }
          }
          break;
        case 'ArrowRight':
          {
            const activeId = document.activeElement?.getAttribute('data-dpad-id');
            const isButtonFocused = activeId && activeId !== 'player-timeline-slider';
            if (!isButtonFocused) {
              e.preventDefault();
              if (isLive) {
                if (onNextTrack) onNextTrack();
              } else {
                seek(10);
              }
            }
          }
          break;
        case 'ArrowUp':
          if (videoRef.current) {
            e.preventDefault();
            const newVol = Math.min(1, videoRef.current.volume + 0.1);
            handleVolumeChange(newVol);
          }
          break;
        case 'ArrowDown':
          if (videoRef.current) {
            e.preventDefault();
            const newVol = Math.max(0, videoRef.current.volume - 0.1);
            handleVolumeChange(newVol);
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (showAudioSubMenu) {
            setShowAudioSubMenu(false);
          } else {
            handleClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, showAudioSubMenu, onClose]);

  const hasMultipleTracks = audioTracks.length > 1 || subtitleTracks.length > 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden font-['Outfit'] select-none"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoadingVideo(false);
          setIsBuffering(false);
        }}
        onCanPlay={() => {
          setIsLoadingVideo(false);
          setIsBuffering(false);
        }}
        onLoadedData={() => {
          setIsLoadingVideo(false);
          setIsBuffering(false);
        }}
        onWaiting={() => setIsBuffering(true)}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onStalled={() => setIsBuffering(true)}
        onEnded={() => {
          setIsPlaying(false);
          setIsBuffering(false);
          if (videoRef.current) triggerSaveProgress(videoRef.current.currentTime, videoRef.current.duration);
        }}
        onError={() => {
          setIsLoadingVideo(false);
          setIsBuffering(false);
          setErrorMsg('Reconectando señal de transmisión...');
        }}
        className={`w-full h-full object-contain ${showControls || showAudioSubMenu ? 'subtitles-up' : ''}`}
        autoPlay
        playsInline
      >
        {proxySubtitleTracks.map((track, trackIdx) => (
          <track
            key={track.id}
            kind="subtitles"
            src={`/api_subtitles?id=${itemData.id}&type=${itemData.type}&action=vtt&track=${track.id}&ext=${itemData.container_extension || 'mkv'}`}
            srcLang={track.lang}
            label={track.name}
            onLoad={(e) => {
              // When the VTT loads, re-apply showing mode if this track is selected
              const nativeId = `native-${trackIdx}`;
              if (selectedSubtitleTrack === nativeId && e.target.track) {
                e.target.track.mode = 'showing';
              }
            }}
          />
        ))}
      </video>

      {/* On-Screen Seek Ripple Animation Overlay (Centered in Screen) */}
      {seekFeedback && (
        <div className="absolute inset-0 pointer-events-none z-35 flex items-center justify-around px-8 sm:px-24 overflow-hidden">
          {seekFeedback.type === 'rewind' ? (
            <div key={seekFeedback.id} className="flex flex-col items-center justify-center gap-2 bg-black/80 border border-red-600/60 text-white font-bold px-8 py-6 rounded-3xl backdrop-blur-md shadow-2xl shadow-red-950/90 animate-fadeIn scale-110 select-none">
              <Rewind10Icon className="w-12 h-12 text-red-500 animate-pulse" />
              <span className="text-sm font-mono font-bold tracking-widest text-red-400">{seekFeedback.label}</span>
            </div>
          ) : <div />}

          {seekFeedback.type === 'forward' ? (
            <div key={seekFeedback.id} className="flex flex-col items-center justify-center gap-2 bg-black/80 border border-red-600/60 text-white font-bold px-8 py-6 rounded-3xl backdrop-blur-md shadow-2xl shadow-red-950/90 animate-fadeIn scale-110 select-none">
              <Forward10Icon className="w-12 h-12 text-red-500 animate-pulse" />
              <span className="text-sm font-mono font-bold tracking-widest text-red-400">{seekFeedback.label}</span>
            </div>
          ) : <div />}
        </div>
      )}

      {/* Video Loading Animation Overlay */}
      {isLoadingVideo && !errorMsg && (
        <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center space-y-6 z-40 transition-opacity duration-500">
          <button
            data-dpad-id="player-loading-close"
            onClick={handleClose}
            className="dpad-focusable absolute top-6 left-6 p-3 rounded-full bg-neutral-900/90 hover:bg-red-600 text-white transition-all cursor-pointer border border-neutral-700 z-50 flex items-center gap-2 text-xs font-semibold shadow-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Cancelar y Volver</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
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

      {/* Buffering Overlay (Glassmorphism design) */}
      {isBuffering && !isLoadingVideo && !errorMsg && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-30 bg-black/30 backdrop-blur-[2px] transition-all animate-fadeIn">
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-neutral-950/80 border border-neutral-800/80 shadow-2xl text-center space-y-4 max-w-xs">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
              <Tv className="absolute w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white tracking-wide">Optimizando buffer...</p>
              <p className="text-[11px] text-neutral-400">Recuperando fragmentos en red lenta</p>
            </div>
          </div>
        </div>
      )}

      {/* Track Switching Transition Overlay */}
      {trackTransition && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-45 bg-black/60 backdrop-blur-[3px] transition-all animate-fadeIn">
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-neutral-950/85 border border-red-800/40 shadow-2xl text-center space-y-4 max-w-sm">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
              <Languages className="absolute w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white tracking-wide">
                {trackTransition.type === 'audio' ? 'Cambiando Audio...' : 'Cambiando Subtítulo...'}
              </p>
              <p className="text-[11px] text-neutral-400">
                Aplicando: {trackTransition.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking Floating Error / Reconnect Toast Banner */}
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

      {/* Audio & Subtitles Menu Modal Overlay */}
      {showAudioSubMenu && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="glass-panel border border-neutral-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Audio y Subtítulos</h3>
              </div>
              <button
                data-dpad-id="player-audiosub-close"
                onClick={() => setShowAudioSubMenu(false)}
                className="dpad-focusable p-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Tabs */}
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
              <button
                data-dpad-id="player-tab-audio"
                onClick={() => setActiveMenuTab('audio')}
                className={`dpad-focusable flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeMenuTab === 'audio' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Idiomas de Audio ({audioTracks.length || 1})
              </button>
              <button
                data-dpad-id="player-tab-subtitles"
                onClick={() => setActiveMenuTab('subtitles')}
                className={`dpad-focusable flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeMenuTab === 'subtitles' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Subtítulos ({subtitleTracks.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {activeMenuTab === 'audio' && (
                audioTracks.length <= 1 ? (
                  <div className="py-4 text-center space-y-2">
                    <p className="text-xs text-neutral-400 font-medium">Pista Única de Audio Incorporada</p>
                    <p className="text-[11px] text-neutral-500 leading-relaxed px-4">
                      Esta película/canal posee una pista de audio codificada en su transmisión original. Si la película está en inglés, busca en las categorías la versión <span className="text-red-400 font-semibold">"Latino"</span> o <span className="text-red-400 font-semibold">"Subtitulada"</span>.
                    </p>
                  </div>
                ) : (
                  audioTracks.map((track, idx) => (
                    <button
                      key={idx}
                      data-dpad-id={`player-audio-track-${idx}`}
                      onClick={() => handleSelectAudioTrack(idx)}
                      className={`dpad-focusable w-full px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                        selectedAudioTrack === idx
                          ? 'bg-red-950/80 border-red-600 text-white'
                          : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span>{track.name || track.lang || `Idioma ${idx + 1}`}</span>
                      {selectedAudioTrack === idx && <Check className="w-4 h-4 text-red-500" />}
                    </button>
                  ))
                )
              )}

              {activeMenuTab === 'subtitles' && (
                <>
                  <button
                    data-dpad-id="player-sub-track-off"
                    onClick={() => handleSelectSubtitleTrack(-1)}
                    className={`dpad-focusable w-full px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      selectedSubtitleTrack === -1
                        ? 'bg-red-950/80 border-red-600 text-white'
                        : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <span>Desactivados</span>
                    {selectedSubtitleTrack === -1 && <Check className="w-4 h-4 text-red-500" />}
                  </button>

                  {subtitleTracks.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic py-4 text-center">
                      No hay pistas de subtítulos incrustadas en este archivo.
                    </p>
                  ) : (
                    subtitleTracks.map((track, idx) => (
                      <button
                        key={idx}
                        data-dpad-id={`player-sub-track-${idx}`}
                        onClick={() => handleSelectSubtitleTrack(idx)}
                        className={`dpad-focusable w-full px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          selectedSubtitleTrack === idx
                            ? 'bg-red-950/80 border-red-600 text-white'
                            : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                        }`}
                      >
                        <span>{track.name || track.lang || `Subtítulo ${idx + 1}`}</span>
                        {selectedSubtitleTrack === idx && <Check className="w-4 h-4 text-red-500" />}
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
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
          {/* Interactive Timeline Progress Bar Slider */}
          {duration > 0 && (
            <div className="space-y-1 group">
              <div className="relative w-full flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="1"
                  value={currentTime || 0}
                  onChange={handleTimelineSeek}
                  data-dpad-id="player-timeline-slider"
                  className="dpad-focusable w-full accent-red-600 h-2 bg-neutral-800 rounded-full cursor-pointer appearance-none transition-all hover:h-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Deslizar para adelantar o retroceder"
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-400 font-mono pt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons: Left (Volume), Center (Play/Rewind/Forward), Right (Audio & Subtitles, PiP, Fullscreen) */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Volume Control with Level Indicator & Slider */}
            <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-2 rounded-2xl">
              <button
                data-dpad-id="player-btn-mute"
                onClick={toggleMute}
                className="dpad-focusable p-1.5 rounded-lg text-neutral-300 hover:text-white transition cursor-pointer"
                title="Silenciar / Activar Sonido"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-500" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-20 accent-red-600 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
              <span className="text-[11px] font-mono font-bold text-neutral-400 min-w-[32px] text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>

            {/* Center: Main Playback Controls (Rewind -10 or SkipBack, Play/Pause, Forward +10 or SkipForward) */}
            <div className="flex items-center gap-4">
              <button
                data-dpad-id="player-btn-rewind"
                onClick={() => {
                  if (isLive) {
                    if (onPrevTrack) onPrevTrack();
                  } else {
                    seek(-10);
                  }
                }}
                className="dpad-focusable p-3 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 transition-all cursor-pointer border border-neutral-800 shadow-md flex items-center justify-center"
                title={isLive ? 'Canal anterior' : 'Retroceder 10 segundos'}
              >
                {isLive ? (
                  <SkipBack className="w-6 h-6 text-neutral-200" />
                ) : (
                  <Rewind10Icon className="w-6 h-6 text-neutral-200" />
                )}
              </button>

              <button
                data-dpad-id="player-btn-play"
                onClick={togglePlay}
                className="dpad-focusable p-4 sm:p-5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer shadow-xl shadow-red-950/80 hover:scale-105"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
              </button>

              <button
                data-dpad-id="player-btn-forward"
                onClick={() => {
                  if (isLive) {
                    if (onNextTrack) onNextTrack();
                  } else {
                    seek(10);
                  }
                }}
                className="dpad-focusable p-3 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 transition-all cursor-pointer border border-neutral-800 shadow-md flex items-center justify-center"
                title={isLive ? 'Canal siguiente' : 'Adelantar 10 segundos'}
              >
                {isLive ? (
                  <SkipForward className="w-6 h-6 text-neutral-200" />
                ) : (
                  <Forward10Icon className="w-6 h-6 text-neutral-200" />
                )}
              </button>
            </div>

            {/* Right: Audio & Subtitles Button + Picture-in-Picture + Fullscreen */}
            <div className="flex items-center gap-2.5">
              <button
                data-dpad-id="player-btn-audiosub"
                onClick={() => { syncTracks(); setShowAudioSubMenu(true); }}
                className={`dpad-focusable px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer border flex items-center gap-2 text-xs font-bold ${
                  showAudioSubMenu || hasMultipleTracks
                    ? 'bg-red-950/90 border-red-600 text-white shadow-lg shadow-red-950/50'
                    : 'bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
                title="Idiomas de Audio y Subtítulos"
              >
                <Languages className="w-4 h-4 text-red-500" />
                <span className="hidden sm:inline">Audio y Subtítulos</span>
              </button>

              <button
                data-dpad-id="player-btn-pip"
                onClick={togglePictureInPicture}
                className="dpad-focusable p-2.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer border border-neutral-800"
                title="Ventana Flotante / Picture-in-Picture (Segundo Plano)"
              >
                <PictureInPicture className="w-5 h-5" />
              </button>

              <button
                data-dpad-id="player-btn-fullscreen"
                onClick={toggleFullscreen}
                className="dpad-focusable p-2.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer border border-neutral-800"
                title="Pantalla Completa"
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
