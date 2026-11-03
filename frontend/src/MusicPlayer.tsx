import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, ListMusic, Music2, Pause, Play, RefreshCw, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import './music.css';

type Track = {
  id: number; title: string; author: string; artist_name: string; artist_website: string;
  audio: string; cover_art: string | null; audio_description: string; artist_description: string;
  duration_seconds: number; is_published: boolean;
};
type Preferences = {
  order: number[]; currentId: number | null; repeat: 'off' | 'one' | 'all';
  muted: boolean; volume: number; enabled: boolean;
};
const storageKey = 'relay:music:v1';

function readPreferences(): Preferences {
  const defaults: Preferences = { order: [], currentId: null, repeat: 'all', muted: false, volume: .65, enabled: true };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {
      order: Array.isArray(saved.order) ? [...new Set<number>(saved.order.filter((id: unknown) => Number.isInteger(id)))] : [],
      currentId: Number.isInteger(saved.currentId) ? saved.currentId : null,
      repeat: ['off', 'one', 'all'].includes(saved.repeat) ? saved.repeat : defaults.repeat,
      muted: typeof saved.muted === 'boolean' ? saved.muted : defaults.muted,
      volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : defaults.volume,
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
    };
  } catch { return defaults; }
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playlistButton = useRef<HTMLButtonElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [preferences, setPreferences] = useState(readPreferences);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const playAttempt = useRef(0);
  const loadedSource = useRef('');
  const queue = preferences.order.flatMap(id => tracks.find(track => track.id === id) || []);
  const current = tracks.find(track => track.id === preferences.currentId);

  const refresh = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/music/tracks/', { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('Library unavailable');
      const data: Track[] = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid library');
      if (controller.signal.aborted) return;
      // Staff can also see drafts in the API; the public player only queues published music.
      const published = data.filter(track => track.is_published);
      const ids = published.map(track => track.id);
      setTracks(published);
      setPreferences(previous => {
        const order = [...previous.order.filter(id => ids.includes(id)), ...ids.filter(id => !previous.order.includes(id))];
        return { ...previous, order, currentId: previous.currentId !== null && ids.includes(previous.currentId) ? previous.currentId : order[0] ?? null };
      });
      setLibraryError('');
    } catch {
      setLibraryError('Music library unavailable. Try refreshing the tracks.');
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(poll); window.removeEventListener('focus', onFocus); requestRef.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Listening still works without storage. */ }
  }, [preferences]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = preferences.muted;
    audioRef.current.volume = preferences.volume;
    audioRef.current.loop = preferences.repeat === 'one';
  }, [preferences.muted, preferences.volume, preferences.repeat]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.getAttribute('src')) return;
    if (audio.error) audio.load();
    const attempt = ++playAttempt.current;
    setPlaybackError('');
    void audio.play().catch((error: DOMException) => {
      if (attempt !== playAttempt.current || error.name === 'AbortError') return;
      setPlaying(false);
      setPreferences(previous => ({ ...previous, enabled: false }));
      setPlaybackError(error.name === 'NotAllowedError' ? 'Press Play to start the music.' : 'This track could not play. Retry or choose another song.');
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const source = current?.audio || '';
    if (source !== loadedSource.current) {
      ++playAttempt.current;
      audio.pause();
      loadedSource.current = source;
      if (source) audio.src = source;
      else audio.removeAttribute('src');
      audio.load();
      setElapsed(0); setDuration(0); setPlaybackError('');
    }
    if (source && preferences.enabled) play();
    else { ++playAttempt.current; audio.pause(); }
  }, [current?.audio, preferences.enabled, play]);

  function selectTrack(id: number) {
    setPreferences(previous => ({ ...previous, currentId: id, enabled: true }));
    if (id === current?.id) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      play();
    }
  }

  function next(manual = false) {
    if (!queue.length) return;
    const index = queue.findIndex(track => track.id === preferences.currentId);
    if (manual || index < queue.length - 1 || preferences.repeat === 'all') {
      selectTrack(queue[(index + 1) % queue.length].id);
    } else {
      setPreferences(previous => ({ ...previous, enabled: false }));
      setPlaying(false);
    }
  }

  function move(id: number, offset: number) {
    setPreferences(previous => {
      const order = [...previous.order];
      const index = order.indexOf(id), target = index + offset;
      if (index < 0 || target < 0 || target >= order.length) return previous;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...previous, order };
    });
  }

  function togglePlayback() {
    if (playing) {
      ++playAttempt.current;
      audioRef.current?.pause();
      setPreferences(previous => ({ ...previous, enabled: false }));
    } else {
      setPreferences(previous => ({ ...previous, enabled: true }));
      play();
    }
  }

  const closePlaylist = () => { setExpanded(false); playlistButton.current?.focus(); };
  const total = duration || current?.duration_seconds || 0;
  return <section className="music-player" aria-label="Music player" data-game-input="ignore" onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); closePlaylist(); }
  }}>
    <audio ref={audioRef} preload="metadata" onPlaying={() => { setPlaying(true); setPlaybackError(''); }} onPause={() => setPlaying(false)}
      onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
      onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onEnded={() => { if (preferences.repeat === 'one') { if (audioRef.current) audioRef.current.currentTime = 0; play(); } else next(); }}
      onError={() => { if (!loadedSource.current) return; ++playAttempt.current; setPlaying(false); setPreferences(previous => ({ ...previous, enabled: false })); setPlaybackError('This track is unavailable or unsupported. Choose another song.'); }}/>

    {expanded && <section className="music-library" id="music-library" aria-label="Available tracks">
      <div className="music-library-heading"><div><span className="eyebrow">THE RELAY SESSIONS</span><h2>Your playlist <small>{queue.length} tracks</small></h2></div><button aria-label="Close playlist" onClick={closePlaylist}><X size={18}/></button></div>
      <p className="music-hint">Choose a song. Use the arrows to set your listening order.</p>
      {current && <div className="music-credits">
        <strong>{current.title}</strong>
        {current.artist_name && <span>{current.artist_name}</span>}
        {current.author && <span>Written by {current.author}</span>}
        {current.audio_description && <p>{current.audio_description}</p>}
        {current.artist_description && <p>{current.artist_description}</p>}
        {current.artist_website && /^https?:\/\//i.test(current.artist_website) && <a href={current.artist_website} target="_blank" rel="noopener noreferrer">Artist website <ExternalLink size={12}/></a>}
      </div>}
      <ol className="music-track-list">{queue.map((track, index) => <li key={track.id} className={track.id === current?.id ? 'is-current' : ''}>
        <button className="music-track-select" onClick={() => selectTrack(track.id)} aria-label={`Play ${track.title}`} aria-current={track.id === current?.id ? 'true' : undefined}>
          <span className="music-track-number">{track.id === current?.id && playing ? <Music2 size={14}/> : String(index + 1).padStart(2, '0')}</span>
          <span className="music-track-copy"><strong>{track.title}</strong><small>{track.artist_name || 'Artist not listed'}</small></span>
          <span className="music-track-duration">{clock(track.duration_seconds)}</span>
        </button>
        <div className="music-order"><button aria-label={`Move ${track.title} up`} disabled={index === 0} onClick={() => move(track.id, -1)}><ArrowUp size={14}/></button><button aria-label={`Move ${track.title} down`} disabled={index === queue.length - 1} onClick={() => move(track.id, 1)}><ArrowDown size={14}/></button></div>
      </li>)}</ol>
      {!queue.length && <p className="music-hint">{loading ? 'Loading the music library…' : libraryError || 'New recordings will appear here when they are published.'}</p>}
      <div className="music-library-footer"><span>New releases join your playlist automatically.</span><button aria-label="Refresh tracks" onClick={() => void refresh()}><RefreshCw size={14}/></button></div>
    </section>}

    <div className="music-now">
      <div className="music-cover">{current?.cover_art ? <img src={current.cover_art} alt={`Cover art for ${current.title}`}/> : <Music2 size={23}/>}</div>
      <div className="music-now-copy"><span className="eyebrow">{playing ? 'ON THE AIR' : 'RELAY RADIO'}</span><strong>{current?.title || (loading ? 'Finding your soundtrack…' : 'Your expedition soundtrack')}</strong><span>{current?.artist_name || (current ? 'Original recordings' : 'Open the playlist to explore')}</span></div>
    </div>
    <div className="music-transport">
      <button className="music-play" aria-label={playing ? 'Pause music' : 'Play music'} disabled={!current} onClick={togglePlayback}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button>
      <button aria-label="Next track" title="Next track" disabled={!current} onClick={() => next(true)}><SkipForward size={19}/></button>
      <div className="music-progress"><input type="range" aria-label="Song position" min="0" max={total || 1} step="0.1" value={Math.min(elapsed, total)} disabled={!total} onChange={event => {
        const position = Number(event.target.value);
        if (audioRef.current && Number.isFinite(audioRef.current.duration)) { audioRef.current.currentTime = position; setElapsed(position); }
      }}/><span>{clock(elapsed)} / {clock(total)}</span></div>
    </div>
    <div className="music-settings">
      <button aria-label={preferences.muted ? 'Unmute music' : 'Mute music'} title={preferences.muted ? 'Unmute music' : 'Mute music'} aria-pressed={preferences.muted} onClick={() => setPreferences(previous => ({ ...previous, muted: !previous.muted }))}>{preferences.muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
      <input className="music-volume" type="range" aria-label="Music volume" min="0" max="1" step="0.05" value={preferences.volume} onChange={event => setPreferences(previous => ({ ...previous, volume: Number(event.target.value) }))}/>
      <select aria-label="Repeat mode" value={preferences.repeat} onChange={event => setPreferences(previous => ({ ...previous, repeat: event.target.value as Preferences['repeat'] }))}>
        <option value="off">Repeat off</option><option value="one">Loop song</option><option value="all">Loop playlist</option>
      </select>
      <button ref={playlistButton} className={expanded ? 'music-list-toggle active' : 'music-list-toggle'} aria-label="Show playlist" aria-expanded={expanded} aria-controls="music-library" title="Available tracks" onClick={() => setExpanded(value => !value)}><ListMusic size={20}/><span>{queue.length}</span></button>
    </div>
    {(playbackError || libraryError) && <div className="music-message" aria-live="polite">{playbackError || libraryError}{libraryError && <button onClick={() => void refresh()}>Retry</button>}</div>}
  </section>;
}
