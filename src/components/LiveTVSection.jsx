import React, { useState, useEffect, useMemo } from 'react';
import { Search, Tv, Play, Radio, Filter, RefreshCw } from 'lucide-react';
import { getLiveCategories, getLiveStreams, getAllLiveStreams, getLiveStreamUrl } from '../services/xtream';
import { getOptimizedImageUrl, handleImageError } from '../utils/imageProxy';
import PaginationControls from './PaginationControls';

const ITEMS_PER_PAGE = 24;

export default function LiveTVSection({ onPlayStream }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Initial load: Fetch Live categories
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const cats = await getLiveCategories();
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
        }
      } catch (err) {
        setError('No se pudieron cargar las categorías de TV en vivo.');
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Fetch channels: If 'ALL' or searching, fetch across all categories concurrently
  useEffect(() => {
    if (categories.length === 0) return;

    const loadChannels = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);

      try {
        let streams = [];
        if (selectedCategory === 'ALL' || searchQuery.trim() !== '') {
          streams = await getAllLiveStreams(categories);
        } else {
          streams = await getLiveStreams(selectedCategory);
        }

        if (Array.isArray(streams)) {
          setChannels(streams);
          if (streams.length > 0) {
            setSelectedChannel(streams[0]);
          }
        } else {
          setChannels([]);
        }
      } catch (err) {
        console.error('Error fetching live channels:', err);
        setError('No se pudieron cargar los canales de TV.');
        setChannels([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadChannels, searchQuery.trim() ? 400 : 0);
    return () => clearTimeout(timer);
  }, [selectedCategory, categories, searchQuery]);

  const filteredChannels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((ch) => ch.name?.toLowerCase().includes(query));
  }, [channels, searchQuery]);

  const totalPages = Math.ceil(filteredChannels.length / ITEMS_PER_PAGE) || 1;

  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredChannels.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredChannels, currentPage]);

  return (
    <div className="flex-1 h-full flex flex-col md:flex-row overflow-hidden bg-[#141414]">
      {/* Category List Sidebar (Desktop) */}
      <div className="hidden md:flex w-72 glass-panel border-r border-neutral-800 flex-col p-4 space-y-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
          <Filter className="w-4 h-4 text-red-600" />
          <span>Categorías Live</span>
        </div>

        {/* Search Bar Desktop */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-dpad-id="livetv-search-input"
            type="text"
            placeholder="Buscar canal global..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dpad-focusable w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-600 outline-none"
          />
        </div>

        {/* Categories List Desktop */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          <button
            data-dpad-id="livetv-cat-all"
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
            className={`dpad-focusable w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
              selectedCategory === 'ALL' && !searchQuery
                ? 'bg-red-600 text-white font-bold shadow-md scale-[1.02]'
                : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
            }`}
          >
            <span>Todos los Canales</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30">Global</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory?.toString() === cat.category_id.toString() && !searchQuery;
            return (
              <button
                key={cat.category_id}
                data-dpad-id={`livetv-cat-${cat.category_id}`}
                onClick={() => {
                  setSelectedCategory(cat.category_id);
                  setSearchQuery('');
                }}
                className={`dpad-focusable w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all truncate cursor-pointer ${
                  isSelected
                    ? 'bg-red-600 text-white font-bold shadow-md scale-[1.02]'
                    : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                }`}
              >
                {cat.category_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area (Mobile + Desktop) */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden space-y-4">
        {/* Mobile Top Controls: Search Bar & Horizontal Category Chips */}
        <div className="flex flex-col space-y-3 md:hidden">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              data-dpad-id="livetv-search-input-mobile"
              type="text"
              placeholder="Buscar canal global..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dpad-focusable w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              data-dpad-id="livetv-cat-all-mobile"
              onClick={() => {
                setSelectedCategory('ALL');
                setSearchQuery('');
              }}
              className={`dpad-focusable px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'ALL' && !searchQuery
                  ? 'bg-red-600 text-white shadow-md font-bold'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
              }`}
            >
              Todos los Canales
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory?.toString() === cat.category_id.toString() && !searchQuery;
              return (
                <button
                  key={cat.category_id}
                  data-dpad-id={`livetv-cat-mobile-${cat.category_id}`}
                  onClick={() => {
                    setSelectedCategory(cat.category_id);
                    setSearchQuery('');
                  }}
                  className={`dpad-focusable px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white font-bold shadow-md'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                  }`}
                >
                  {cat.category_name}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center flex-col space-y-3">
            <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-sm font-medium text-neutral-400">
              {searchQuery.trim() ? `Buscando "${searchQuery}" en todos los canales...` : 'Cargando canales en vivo...'}
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center flex-col space-y-2 text-center">
            <p className="text-red-500 font-semibold">{error}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden justify-between">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                <span>
                  {searchQuery.trim() ? `Resultados ("${searchQuery}")` : 'Canales Disponibles'}
                </span>
                <span className="text-xs font-normal text-neutral-400">({filteredChannels.length})</span>
              </h2>
            </div>

            {/* Grid of Channels */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 pr-1 content-start">
              {paginatedChannels.map((ch) => {
                const isSelected = selectedChannel?.stream_id === ch.stream_id;
                const iconUrl = getOptimizedImageUrl(ch.stream_icon, 150);

                return (
                  <div
                    key={ch.stream_id}
                    data-dpad-id={`livetv-ch-${ch.stream_id}`}
                    onClick={() => {
                      setSelectedChannel(ch);
                      onPlayStream({
                        id: ch.stream_id,
                        type: 'live',
                        title: ch.name,
                        subtitle: `Canal #${ch.num || ch.stream_id}`,
                        poster: ch.stream_icon,
                        url: getLiveStreamUrl(ch.stream_id),
                      });
                    }}
                    className={`dpad-focusable glass-panel p-2.5 sm:p-3 rounded-2xl flex items-center gap-2.5 sm:gap-3 cursor-pointer border transition-all duration-200 ${
                      isSelected
                        ? 'border-red-600 bg-red-950/40 shadow-lg shadow-red-950/50 scale-[1.02]'
                        : 'border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-neutral-900 flex items-center justify-center overflow-hidden border border-neutral-800 flex-shrink-0">
                      {ch.stream_icon ? (
                        <img
                          src={iconUrl}
                          alt={ch.name}
                          loading="lazy"
                          onError={handleImageError}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : null}
                      <Tv className="w-5 h-5 text-neutral-600 hidden" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{ch.name}</p>
                      <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                        <Radio className="w-2.5 h-2.5 animate-pulse" /> EN VIVO
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredChannels.length}
              onPageChange={(page) => setCurrentPage(page)}
              sectionId="livetv"
            />
          </div>
        )}
      </div>

      {/* Right: Selected Channel Details Preview Card (Desktop Only) */}
      {selectedChannel && (
        <div className="w-80 glass-panel border-l border-neutral-800 p-6 flex flex-col justify-between hidden xl:flex select-none flex-shrink-0">
          <div className="space-y-6">
            <div className="relative aspect-video rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden flex items-center justify-center shadow-xl">
              {selectedChannel.stream_icon ? (
                <img
                  src={getOptimizedImageUrl(selectedChannel.stream_icon, 300)}
                  alt={selectedChannel.name}
                  loading="lazy"
                  onError={handleImageError}
                  className="w-24 h-24 object-contain"
                />
              ) : (
                <Tv className="w-16 h-16 text-neutral-700" />
              )}
              <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Radio className="w-3 h-3" /> LIVE
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white leading-tight">{selectedChannel.name}</h3>
              <p className="text-xs text-neutral-400">Stream ID: #{selectedChannel.stream_id}</p>
            </div>
          </div>

          <button
            data-dpad-id="livetv-preview-play-btn"
            onClick={() => {
              onPlayStream({
                id: selectedChannel.stream_id,
                type: 'live',
                title: selectedChannel.name,
                subtitle: `Canal #${selectedChannel.num || selectedChannel.stream_id}`,
                poster: selectedChannel.stream_icon,
                url: getLiveStreamUrl(selectedChannel.stream_id),
              });
            }}
            className="dpad-focusable w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/80 transition-all transform hover:scale-[1.02]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Reproducir a Pantalla Completa</span>
          </button>
        </div>
      )}
    </div>
  );
}
