import React, { useState, useEffect, useMemo } from 'react';
import { Search, Clapperboard, Play, Star, RefreshCw, X, ChevronRight } from 'lucide-react';
import { getSeriesCategories, getSeriesList, getAllSeriesList, getSeriesInfo, getEpisodeStreamUrl } from '../services/xtream';
import { getOptimizedImageUrl, handleImageError } from '../utils/imageProxy';
import PaginationControls from './PaginationControls';

const ITEMS_PER_PAGE = 24;

export default function SeriesSection({ onPlayStream }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [seriesList, setSeriesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Series & Season State
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [activeSeason, setActiveSeason] = useState('1');

  // Initial load: Fetch series categories
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const cats = await getSeriesCategories();
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
        }
      } catch (err) {
        setError('No se pudieron cargar las categorías de series.');
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Load series: If 'ALL' or searching, fetch from all categories concurrently
  useEffect(() => {
    if (categories.length === 0) return;

    const loadSeries = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);

      try {
        let series = [];
        if (selectedCategory === 'ALL' || searchQuery.trim() !== '') {
          series = await getAllSeriesList(categories);
        } else {
          series = await getSeriesList(selectedCategory);
        }

        if (Array.isArray(series)) {
          setSeriesList(series);
        } else {
          setSeriesList([]);
        }
      } catch (err) {
        console.error('Error loading series:', err);
        setError('No se pudieron cargar las series.');
        setSeriesList([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadSeries, searchQuery.trim() ? 400 : 0);
    return () => clearTimeout(timer);
  }, [selectedCategory, categories, searchQuery]);

  const openSeriesDetails = async (series) => {
    setSelectedSeries(series);
    setLoadingInfo(true);
    setSeriesInfo(null);
    try {
      const info = await getSeriesInfo(series.series_id);
      setSeriesInfo(info);

      if (info?.episodes) {
        const seasonKeys = Object.keys(info.episodes);
        if (seasonKeys.length > 0) {
          setActiveSeason(seasonKeys[0]);
        }
      }
    } catch (err) {
      console.error('Error loading series info:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const filteredSeries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return seriesList;
    return seriesList.filter((s) => s.name?.toLowerCase().includes(query));
  }, [seriesList, searchQuery]);

  const totalPages = Math.ceil(filteredSeries.length / ITEMS_PER_PAGE) || 1;

  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSeries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSeries, currentPage]);

  const currentEpisodes = useMemo(() => {
    if (!seriesInfo?.episodes || !activeSeason) return [];
    return seriesInfo.episodes[activeSeason] || [];
  }, [seriesInfo, activeSeason]);

  return (
    <div className="flex-1 flex flex-col bg-[#141414] p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-2xl text-red-500">
            <Clapperboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Catálogo de Series</h2>
            <p className="text-xs text-neutral-400">
              {searchQuery.trim()
                ? `Búsqueda global: ${filteredSeries.length} resultados para "${searchQuery}"`
                : `Total: ${filteredSeries.length} series`}
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-dpad-id="series-search-input"
            type="text"
            placeholder="Buscar serie en todo el catálogo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dpad-focusable w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-600 outline-none"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          data-dpad-id="series-cat-all"
          onClick={() => {
            setSelectedCategory('ALL');
            setSearchQuery('');
          }}
          className={`dpad-focusable px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === 'ALL' && !searchQuery
              ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 font-bold scale-[1.02]'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Todas las Series
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory?.toString() === cat.category_id.toString() && !searchQuery;
          return (
            <button
              key={cat.category_id}
              data-dpad-id={`series-cat-${cat.category_id}`}
              onClick={() => {
                setSelectedCategory(cat.category_id);
                setSearchQuery('');
              }}
              className={`dpad-focusable px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-red-600 text-white font-bold shadow-lg shadow-red-900/40 scale-[1.02]'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {cat.category_name}
            </button>
          );
        })}
      </div>

      {/* Series Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center flex-col space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-medium text-neutral-400">
            {searchQuery.trim() ? `Buscando "${searchQuery}" en todas las series...` : 'Cargando series...'}
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center flex-col space-y-2 text-center">
          <p className="text-red-500 font-semibold">{error}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col justify-between pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {paginatedSeries.map((s) => {
              const coverUrl = getOptimizedImageUrl(s.cover, 300);

              return (
                <div
                  key={s.series_id}
                  data-dpad-id={`series-item-${s.series_id}`}
                  onClick={() => openSeriesDetails(s)}
                  className="dpad-focusable group relative bg-neutral-900 rounded-2xl border border-neutral-800/80 overflow-hidden cursor-pointer flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:border-neutral-700"
                >
                  <div className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden">
                    {s.cover ? (
                      <img
                        src={coverUrl}
                        alt={s.name}
                        loading="lazy"
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}

                    <div className="w-full h-full flex items-center justify-center bg-neutral-950 hidden">
                      <Clapperboard className="w-12 h-12 text-neutral-700" />
                    </div>

                    {s.rating && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{s.rating}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight">{s.name}</h3>
                    <span className="text-[10px] text-neutral-500 font-mono font-semibold">
                      Serie TV
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSeries.length}
            onPageChange={(page) => setCurrentPage(page)}
            sectionId="series"
          />
        </div>
      )}

      {/* Series Season & Episode Modal Overlay */}
      {selectedSeries && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 select-none">
          <div className="glass-panel border border-neutral-700/80 w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-16 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 flex-shrink-0">
                  {selectedSeries.cover ? (
                    <img
                      src={getOptimizedImageUrl(selectedSeries.cover, 150)}
                      alt={selectedSeries.name}
                      loading="lazy"
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Clapperboard className="w-6 h-6 text-neutral-700 m-auto" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedSeries.name}</h2>
                  <p className="text-xs text-neutral-400 font-medium">Selecciona Temporada y Episodio</p>
                </div>
              </div>

              <button
                data-dpad-id="series-modal-close"
                onClick={() => setSelectedSeries(null)}
                className="dpad-focusable p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingInfo ? (
              <div className="flex-1 flex items-center justify-center flex-col p-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
                <p className="text-sm font-medium text-neutral-400">Cargando episodios de la serie...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
                <div className="w-full md:w-56 glass-panel border-b md:border-b-0 md:border-r border-neutral-800 p-3 sm:p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto flex-shrink-0">
                  <p className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Temporadas</p>
                  {seriesInfo?.episodes && Object.keys(seriesInfo.episodes).map((seasonKey) => (
                    <button
                      key={seasonKey}
                      data-dpad-id={`series-season-${seasonKey}`}
                      onClick={() => setActiveSeason(seasonKey)}
                      className={`dpad-focusable px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap md:w-full text-left transition-all cursor-pointer ${
                        activeSeason.toString() === seasonKey.toString()
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Temporada {seasonKey}
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-3">
                  <h3 className="text-sm font-bold text-neutral-300 mb-3">
                    Episodios (Temporada {activeSeason})
                  </h3>

                  {currentEpisodes.length === 0 ? (
                    <p className="text-xs text-neutral-500 italic">No hay episodios cargados para esta temporada.</p>
                  ) : (
                    currentEpisodes.map((ep) => (
                      <div
                        key={ep.id}
                        data-dpad-id={`series-ep-${ep.id}`}
                        onClick={() => {
                          const playUrl = getEpisodeStreamUrl(ep.id, ep.container_extension);
                          const audioCodec = ep.info?.audio?.codec_name || ep.audio?.codec_name;
                          onPlayStream({
                            id: ep.id,
                            type: 'series',
                            title: `${selectedSeries.name} - E${ep.episode_num || ''}`,
                            subtitle: ep.title || `Episodio ${ep.episode_num}`,
                            poster: selectedSeries.cover,
                            url: playUrl,
                            audioCodec: audioCodec,
                            container_extension: ep.container_extension
                          });
                          setSelectedSeries(null);
                        }}
                        className="dpad-focusable bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 flex items-center justify-between gap-4 hover:border-red-600 hover:bg-neutral-800 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 text-red-500 flex items-center justify-center flex-shrink-0">
                            <Play className="w-4 h-4 fill-current" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">
                              {ep.episode_num ? `Episodio ${ep.episode_num}: ` : ''} {ep.title || 'Sin título'}
                            </p>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              Formato: {ep.container_extension || 'MP4'}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
