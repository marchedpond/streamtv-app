import React, { useState, useEffect, useMemo } from 'react';
import { Search, Film, Play, Star, RefreshCw, X } from 'lucide-react';
import { getVodCategories, getVodStreams, getAllVodStreams, getMovieStreamUrl, getVodInfo } from '../services/xtream';
import { getOptimizedImageUrl, handleImageError } from '../utils/imageProxy';
import PaginationControls from './PaginationControls';

const ITEMS_PER_PAGE = 24;

export default function MoviesSection({ onPlayStream }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [movies, setMovies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetail, setMovieDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Initial load: Fetch VOD categories
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const cats = await getVodCategories();
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
        }
      } catch (err) {
        setError('No se pudieron cargar las categorías de películas.');
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Load movies: If 'ALL' or searching, fetch from all categories concurrently
  useEffect(() => {
    if (categories.length === 0) return;

    const loadMovies = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);

      try {
        let vods = [];
        if (selectedCategory === 'ALL' || searchQuery.trim() !== '') {
          vods = await getAllVodStreams(categories);
        } else {
          vods = await getVodStreams(selectedCategory);
        }

        if (Array.isArray(vods)) {
          setMovies(vods);
        } else {
          setMovies([]);
        }
      } catch (err) {
        console.error('Error loading movies:', err);
        setError('No se pudieron cargar las películas.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadMovies, searchQuery.trim() ? 400 : 0);
    return () => clearTimeout(timer);
  }, [selectedCategory, categories, searchQuery]);

  const openMovieDetails = async (movie) => {
    setSelectedMovie(movie);
    setLoadingDetail(true);
    try {
      const info = await getVodInfo(movie.stream_id);
      setMovieDetail(info);
    } catch (err) {
      console.error('Error loading movie details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredMovies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return movies;
    return movies.filter((m) => m.name?.toLowerCase().includes(query));
  }, [movies, searchQuery]);

  const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE) || 1;

  const paginatedMovies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMovies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMovies, currentPage]);

  return (
    <div className="flex-1 flex flex-col bg-[#141414] p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Controls: Search & Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-2xl text-red-500">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Catálogo de Películas</h2>
            <p className="text-xs text-neutral-400">
              {searchQuery.trim()
                ? `Búsqueda global: ${filteredMovies.length} resultados para "${searchQuery}"`
                : `Total: ${filteredMovies.length} películas`}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-dpad-id="vod-search-input"
            type="text"
            placeholder="Buscar película en todo el catálogo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dpad-focusable w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-600 outline-none"
          />
        </div>
      </div>

      {/* Category Pills (Horizontal Scrollable) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          data-dpad-id="vod-cat-all"
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
          Todas las Películas
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory?.toString() === cat.category_id.toString() && !searchQuery;
          return (
            <button
              key={cat.category_id}
              data-dpad-id={`vod-cat-${cat.category_id}`}
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

      {/* Movie Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center flex-col space-y-3">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
          <p className="text-sm font-medium text-neutral-400">
            {searchQuery.trim() ? `Buscando "${searchQuery}" en todas las películas...` : 'Cargando películas...'}
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center flex-col space-y-2 text-center">
          <p className="text-red-500 font-semibold">{error}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col justify-between pr-1">
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {paginatedMovies.map((movie) => {
              const posterUrl = getOptimizedImageUrl(movie.stream_icon, 300);

              return (
                <div
                  key={movie.stream_id}
                  data-dpad-id={`vod-movie-${movie.stream_id}`}
                  onClick={() => openMovieDetails(movie)}
                  className="dpad-focusable group relative bg-neutral-900 rounded-2xl border border-neutral-800/80 overflow-hidden cursor-pointer flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:border-neutral-700"
                >
                  <div className="aspect-[2/3] w-full bg-neutral-950 relative overflow-hidden">
                    {movie.stream_icon ? (
                      <img
                        src={posterUrl}
                        alt={movie.name}
                        loading="lazy"
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}

                    <div className="w-full h-full flex items-center justify-center bg-neutral-950 hidden">
                      <Film className="w-12 h-12 text-neutral-700" />
                    </div>

                    {movie.rating && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{movie.rating}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-950/80">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight">{movie.name}</h3>
                    <span className="text-[10px] text-neutral-500 font-mono uppercase font-semibold">
                      {movie.container_extension || 'MP4'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMovies.length}
            onPageChange={(page) => setCurrentPage(page)}
            sectionId="vod"
          />
        </div>
      )}

      {/* Movie Details Modal Overlay */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none animate-fadeIn">
          <div className="glass-panel border border-neutral-700/80 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative flex flex-col md:flex-row">
            <button
              data-dpad-id="vod-modal-close"
              onClick={() => setSelectedMovie(null)}
              className="dpad-focusable absolute top-4 right-4 z-10 p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-full h-44 sm:h-56 md:h-auto md:w-64 bg-neutral-950 relative flex-shrink-0">
              {selectedMovie.stream_icon ? (
                <img
                  src={getOptimizedImageUrl(selectedMovie.stream_icon, 400)}
                  alt={selectedMovie.name}
                  loading="lazy"
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-16 h-16 text-neutral-700" />
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="bg-red-950 text-red-400 border border-red-800/40 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                    Película VOD
                  </span>
                  {selectedMovie.rating && (
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{selectedMovie.rating}</span>
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white leading-tight">{selectedMovie.name}</h2>

                {loadingDetail ? (
                  <p className="text-xs text-neutral-400 animate-pulse">Cargando detalles de la película...</p>
                ) : movieDetail?.info?.plot ? (
                  <p className="text-xs text-neutral-300 leading-relaxed max-h-36 overflow-y-auto">
                    {movieDetail.info.plot}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 italic">No hay descripción disponible para esta película.</p>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-800 flex items-center gap-4">
                <button
                  data-dpad-id="vod-modal-play-btn"
                  onClick={() => {
                    const playUrl = getMovieStreamUrl(selectedMovie.stream_id, selectedMovie.container_extension);
                    const audioCodec = movieDetail?.info?.audio?.codec_name || movieDetail?.audio?.codec_name;
                    onPlayStream({
                      id: selectedMovie.stream_id,
                      type: 'vod',
                      title: selectedMovie.name,
                      subtitle: 'Película HD',
                      poster: selectedMovie.stream_icon,
                      url: playUrl,
                      audioCodec: audioCodec,
                      container_extension: selectedMovie.container_extension,
                      duration: movieDetail?.info?.duration_secs || movieDetail?.info?.duration || selectedMovie.duration
                    });
                    setSelectedMovie(null);
                  }}
                  className="dpad-focusable flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer transition-all"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Reproducir Ahora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
