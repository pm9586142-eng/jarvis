import {
  MediaPlaybackStatus,
  MediaPlayerState,
  MediaRepeatMode,
  YouTubeMediaItem,
} from '../../types/media';

interface YtPlayerLike {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YtNamespaceLike {
  Player: new (
    element: HTMLElement | string,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    }
  ) => YtPlayerLike;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YtNamespaceLike;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiLoadPromise: Promise<YtNamespaceLike> | null = null;

export function loadYouTubeIframeApi(): Promise<YtNamespaceLike> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame Player API requires a browser environment.'));
  }
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve(window.YT);
  }
  if (ytApiLoadPromise) {
    return ytApiLoadPromise;
  }

  ytApiLoadPromise = new Promise<YtNamespaceLike>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      ytApiLoadPromise = null;
      reject(new Error('YouTube IFrame Player API timed out while loading.'));
    }, 12000);

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      try {
        prevCallback?.();
      } catch {
        // Ignore chained callback error
      }
      if (window.YT && typeof window.YT.Player === 'function') {
        resolve(window.YT);
      } else {
        ytApiLoadPromise = null;
        reject(new Error('YouTube IFrame Player API loaded without YT.Player.'));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        ytApiLoadPromise = null;
        reject(new Error('Failed to load the official YouTube IFrame Player API script.'));
      };
      document.head.appendChild(script);
    }
  });

  return ytApiLoadPromise;
}

export interface MediaControlActionResult {
  ok: boolean;
  supported: boolean;
  message: string;
  playbackStatus: MediaPlaybackStatus;
}

export function createInitialMediaPlayerState(defaultVolume = 80): MediaPlayerState {
  return {
    status: 'idle',
    currentTrack: null,
    previousTrack: null,
    queue: [],
    currentIndex: -1,
    currentTimeSec: 0,
    durationSec: 0,
    volume: Math.max(0, Math.min(100, defaultVolume)),
    isMuted: false,
    isDucked: false,
    duckingSupported: true,
    isFullscreen: false,
    repeatMode: 'off',
    isPlayerVisible: false,
    pendingSelectionQuery: null,
    pendingSelectionItems: [],
    fallbackUrl: null,
    statusMessage: null,
    errorMessage: null,
  };
}

export class MediaPlaybackController {
  private state: MediaPlayerState;
  private listeners = new Set<(state: MediaPlayerState) => void>();
  private containerEl: HTMLElement | null = null;
  private player: YtPlayerLike | null = null;
  private playerReady = false;
  private playerInitializing = false;
  private playerEpoch = 0;
  private pendingVideoId: string | null = null;
  private pendingAutoPlay = true;
  private progressTimer: number | null = null;
  private autoplayWatchdog: number | null = null;
  private duckRestoreVolume: number | null = null;
  private activeDuckLevel = 20;
  private duckCount = 0;
  private fullscreenListenerBound = false;
  private handleFullscreenChange = () => {
    if (typeof document === 'undefined') return;
    const fsEl = document.fullscreenElement;
    const isActive = Boolean(
      fsEl && this.containerEl && (fsEl === this.containerEl || this.containerEl.contains(fsEl))
    );
    if (isActive !== this.state.isFullscreen) {
      this.setState({ isFullscreen: isActive });
    }
  };

  constructor(defaultVolume = 80) {
    this.state = createInitialMediaPlayerState(defaultVolume);
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.handleFullscreenChange);
      this.fullscreenListenerBound = true;
    }
  }

  getState(): MediaPlayerState {
    return this.state;
  }

  subscribe(listener: (state: MediaPlayerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<MediaPlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((cb) => cb(this.state));
  }

  attachContainer(el: HTMLElement | null): void {
    if (this.containerEl === el) return;
    this.containerEl = el;
    if (el && this.state.currentTrack && !this.player) {
      void this.ensurePlayer(this.state.currentTrack.videoId, this.pendingAutoPlay);
    }
  }

  private clearAutoplayWatchdog(): void {
    if (this.autoplayWatchdog !== null) {
      window.clearTimeout(this.autoplayWatchdog);
      this.autoplayWatchdog = null;
    }
  }

  private startProgressPolling(): void {
    if (this.progressTimer !== null) return;
    this.progressTimer = window.setInterval(() => {
      if (!this.player || !this.playerReady) return;
      try {
        const cur = Number(this.player.getCurrentTime?.() || 0);
        const dur = Number(this.player.getDuration?.() || 0);
        if (Number.isFinite(cur) && Number.isFinite(dur)) {
          if (
            Math.abs(cur - this.state.currentTimeSec) >= 0.4 ||
            Math.abs(dur - this.state.durationSec) >= 0.5
          ) {
            this.setState({
              currentTimeSec: Math.max(0, cur),
              durationSec: Math.max(0, dur),
            });
          }
        }
      } catch {
        // Ignore transient YouTube IFrame read errors
      }
    }, 750);
  }

  private stopProgressPolling(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private scheduleAutoplayWatchdog(videoId: string): void {
    this.clearAutoplayWatchdog();
    this.autoplayWatchdog = window.setTimeout(() => {
      this.autoplayWatchdog = null;
      if (this.state.currentTrack?.videoId !== videoId) return;
      if (this.state.status === 'loading') {
        this.setState({
          status: 'autoplay_blocked',
          statusMessage:
            'Browser autoplay was blocked. Click Play in the media player to start playback.',
        });
      }
    }, 4200);
  }

  private async ensurePlayer(videoId: string, autoPlay: boolean): Promise<void> {
    if (!this.containerEl) {
      this.pendingVideoId = videoId;
      this.pendingAutoPlay = autoPlay;
      return;
    }

    if (this.player && this.playerReady) {
      try {
        if (autoPlay) {
          this.player.loadVideoById(videoId);
          this.scheduleAutoplayWatchdog(videoId);
        } else {
          this.player.cueVideoById(videoId);
          this.setState({
            status: 'paused',
            statusMessage: 'Track loaded. Click Play to begin.',
          });
        }
        this.applyCurrentVolumeToPlayer();
      } catch {
        this.setState({
          status: 'error',
          errorMessage: 'Unable to load video in the YouTube IFrame player.',
        });
      }
      return;
    }

    if (this.playerInitializing || (this.player && !this.playerReady)) {
      this.pendingVideoId = videoId;
      this.pendingAutoPlay = autoPlay;
      return;
    }

    this.playerInitializing = true;
    const initEpoch = ++this.playerEpoch;
    this.pendingVideoId = videoId;
    this.pendingAutoPlay = autoPlay;

    try {
      const YT = await loadYouTubeIframeApi();
      // Abort cleanly if closePlayer() or destroy() happened while awaiting YouTube IFrame script
      if (!this.containerEl || initEpoch !== this.playerEpoch) return;

      // Mount a dedicated child target so React does not collide with YouTube replacing the node
      this.containerEl.innerHTML = '';
      const mountNode = document.createElement('div');
      mountNode.style.width = '100%';
      mountNode.style.height = '100%';
      this.containerEl.appendChild(mountNode);

      const initialVideoId = this.pendingVideoId || videoId;
      const initialAutoPlay = this.pendingAutoPlay;

      this.player = new YT.Player(mountNode, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: {
          autoplay: initialAutoPlay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          ...(typeof window !== 'undefined' ? { origin: window.location.origin } : {}),
        },
        events: {
          onReady: () => {
            if (initEpoch !== this.playerEpoch) return;
            this.playerReady = true;
            this.applyCurrentVolumeToPlayer();
            this.startProgressPolling();
            const targetId = this.pendingVideoId || initialVideoId;
            if (targetId && targetId !== initialVideoId) {
              if (this.pendingAutoPlay) {
                this.player?.loadVideoById(targetId);
                this.scheduleAutoplayWatchdog(targetId);
              } else {
                this.player?.cueVideoById(targetId);
                this.setState({ status: 'paused', statusMessage: 'Track cued and ready.' });
              }
            } else if (this.pendingAutoPlay) {
              try {
                this.player?.playVideo();
                this.scheduleAutoplayWatchdog(targetId);
              } catch {
                this.setState({
                  status: 'autoplay_blocked',
                  statusMessage: 'Click Play to start playback (browser autoplay guard).',
                });
              }
            } else {
              this.setState({ status: 'paused', statusMessage: 'Track cued and ready.' });
            }
          },
          onStateChange: (event) => {
            if (initEpoch !== this.playerEpoch) return;
            const code = event.data;
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (code === 1) {
              this.clearAutoplayWatchdog();
              this.setState({
                status: 'playing',
                statusMessage: null,
                errorMessage: null,
              });
            } else if (code === 2) {
              this.clearAutoplayWatchdog();
              if (this.state.status !== 'stopped') {
                this.setState({ status: 'paused', statusMessage: null });
              }
            } else if (code === 3) {
              // Buffering means the browser allowed playback to begin; clear short autoplay watchdog
              this.clearAutoplayWatchdog();
              this.setState({ status: 'loading', errorMessage: null });
            } else if (code === 5) {
              if (this.state.status === 'loading') {
                this.setState({
                  status: 'autoplay_blocked',
                  statusMessage: 'Click Play to begin playback (browser autoplay restriction).',
                });
              }
            } else if (code === 0) {
              this.clearAutoplayWatchdog();
              this.handleTrackEnded();
            }
          },
          onError: (event) => {
            this.clearAutoplayWatchdog();
            const errCode = event.data;
            if (errCode === 101 || errCode === 150) {
              this.setState({
                status: 'embed_blocked',
                errorMessage:
                  'This video owner has disabled embedded playback. You can open it directly on YouTube or skip to the next track.',
                fallbackUrl: this.state.currentTrack?.watchUrl || this.state.fallbackUrl,
              });
            } else {
              this.setState({
                status: 'error',
                errorMessage: `YouTube player reported error code ${errCode}. Try the next track or open it on YouTube.`,
                fallbackUrl: this.state.currentTrack?.watchUrl || this.state.fallbackUrl,
              });
            }
          },
        },
      });
    } catch (err) {
      if (initEpoch !== this.playerEpoch) return;
      this.setState({
        status: 'error',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Unable to initialize the YouTube IFrame Player API.',
        fallbackUrl: this.state.currentTrack?.watchUrl || this.state.fallbackUrl,
      });
    } finally {
      if (initEpoch === this.playerEpoch) {
        this.playerInitializing = false;
      }
    }
  }

  private handleTrackEnded(): void {
    if (this.state.repeatMode === 'one' && this.state.currentTrack) {
      try {
        this.player?.seekTo(0, true);
        this.player?.playVideo();
        this.setState({ status: 'playing', currentTimeSec: 0 });
        return;
      } catch {
        // Fall through
      }
    }

    if (this.state.currentIndex + 1 < this.state.queue.length) {
      void this.playTrackAtIndex(this.state.currentIndex + 1);
      return;
    }

    if (this.state.repeatMode === 'all' && this.state.queue.length > 0) {
      void this.playTrackAtIndex(0);
      return;
    }

    this.setState({
      status: 'stopped',
      statusMessage: 'Playback finished.',
    });
  }

  private applyCurrentVolumeToPlayer(): boolean {
    if (!this.player || !this.playerReady) return false;
    try {
      const effectiveVol = this.state.isDucked
        ? Math.min(this.state.volume, this.activeDuckLevel)
        : this.state.volume;
      if (this.state.isMuted) {
        this.player.mute();
      } else {
        this.player.unMute();
        this.player.setVolume(Math.max(0, Math.min(100, Math.round(effectiveVol))));
      }
      return true;
    } catch {
      this.setState({ duckingSupported: false });
      return false;
    }
  }

  async loadQueue(
    items: YouTubeMediaItem[],
    startIndex = 0,
    options: { autoPlay?: boolean; fallbackUrl?: string | null; pendingSelectionQuery?: string | null } = {}
  ): Promise<void> {
    if (!items.length) return;
    const safeIdx = Math.max(0, Math.min(items.length - 1, startIndex));
    const nextTrack = items[safeIdx];
    const autoPlay = options.autoPlay !== false;

    this.setState({
      previousTrack: this.state.currentTrack || this.state.previousTrack,
      currentTrack: nextTrack,
      queue: items.slice(0, 15),
      currentIndex: safeIdx,
      currentTimeSec: 0,
      durationSec: nextTrack.durationSeconds || 0,
      status: autoPlay ? 'loading' : 'paused',
      isPlayerVisible: true,
      pendingSelectionQuery: options.pendingSelectionQuery || null,
      pendingSelectionItems: options.pendingSelectionQuery ? items.slice(0, 15) : [],
      fallbackUrl: options.fallbackUrl || nextTrack.watchUrl,
      statusMessage: autoPlay ? `Loading "${nextTrack.title}"...` : 'Select a result or press Play.',
      errorMessage: null,
    });

    await this.ensurePlayer(nextTrack.videoId, autoPlay);
  }

  setPendingSelection(query: string, items: YouTubeMediaItem[], fallbackUrl: string): void {
    this.setState({
      queue: items.slice(0, 15),
      pendingSelectionQuery: query,
      pendingSelectionItems: items.slice(0, 15),
      fallbackUrl,
      isPlayerVisible: true,
      statusMessage: `Found ${items.length} relevant videos for "${query}". Select one to play.`,
      errorMessage: null,
    });
  }

  setFallbackOnly(fallbackUrl: string, reason: string): void {
    this.setState({
      fallbackUrl,
      status: this.state.currentTrack ? this.state.status : 'idle',
      statusMessage: reason,
      errorMessage: null,
    });
  }

  async playTrackAtIndex(index: number): Promise<MediaControlActionResult> {
    if (index < 0 || index >= this.state.queue.length) {
      return {
        ok: false,
        supported: true,
        message: 'No track exists at that position in the queue, Sir.',
        playbackStatus: this.state.status,
      };
    }
    const track = this.state.queue[index];
    this.setState({
      previousTrack:
        this.state.currentTrack && this.state.currentTrack.videoId !== track.videoId
          ? this.state.currentTrack
          : this.state.previousTrack,
      currentTrack: track,
      currentIndex: index,
      currentTimeSec: 0,
      durationSec: track.durationSeconds || 0,
      status: 'loading',
      isPlayerVisible: true,
      pendingSelectionQuery: null,
      pendingSelectionItems: [],
      fallbackUrl: track.watchUrl,
      statusMessage: `Loading "${track.title}"...`,
      errorMessage: null,
    });
    await this.ensurePlayer(track.videoId, true);
    return {
      ok: true,
      supported: true,
      message: `Playing ${track.title}.`,
      playbackStatus: this.state.status,
    };
  }

  play(): MediaControlActionResult {
    if (!this.state.currentTrack) {
      return {
        ok: false,
        supported: true,
        message: 'No media is currently loaded in the player, Sir. Ask me to play a song or video first.',
        playbackStatus: this.state.status,
      };
    }
    if (!this.player || !this.playerReady) {
      void this.ensurePlayer(this.state.currentTrack.videoId, true);
      return {
        ok: true,
        supported: true,
        message: `Resuming ${this.state.currentTrack.title}, Sir.`,
        playbackStatus: 'loading',
      };
    }
    try {
      this.player.playVideo();
      this.applyCurrentVolumeToPlayer();
      this.setState({ status: 'playing', statusMessage: null, errorMessage: null });
      return {
        ok: true,
        supported: true,
        message: `Resuming ${this.state.currentTrack.title}, Sir.`,
        playbackStatus: 'playing',
      };
    } catch {
      this.setState({
        status: 'autoplay_blocked',
        statusMessage: 'Browser blocked playback. Please click the Play button manually.',
      });
      return {
        ok: false,
        supported: false,
        message: 'Browser blocked automatic resume. Please click the Play button in the media HUD, Sir.',
        playbackStatus: 'autoplay_blocked',
      };
    }
  }

  pause(): MediaControlActionResult {
    if (!this.state.currentTrack || !this.player || !this.playerReady) {
      return {
        ok: false,
        supported: true,
        message: 'No media is currently playing, Sir.',
        playbackStatus: this.state.status,
      };
    }
    try {
      this.player.pauseVideo();
      this.setState({ status: 'paused', statusMessage: 'Paused.' });
      return {
        ok: true,
        supported: true,
        message: 'Playback paused, Sir.',
        playbackStatus: 'paused',
      };
    } catch {
      return {
        ok: false,
        supported: false,
        message: 'Unable to pause the active YouTube player in this browser.',
        playbackStatus: this.state.status,
      };
    }
  }

  async next(): Promise<MediaControlActionResult> {
    if (this.state.queue.length === 0) {
      return {
        ok: false,
        supported: true,
        message: 'The playback queue is empty, Sir.',
        playbackStatus: this.state.status,
      };
    }
    const nextIdx = this.state.currentIndex + 1;
    if (nextIdx >= this.state.queue.length) {
      if (this.state.repeatMode === 'all') {
        return this.playTrackAtIndex(0);
      }
      return {
        ok: false,
        supported: true,
        message: 'You are already on the last track in the current queue, Sir.',
        playbackStatus: this.state.status,
      };
    }
    return this.playTrackAtIndex(nextIdx);
  }

  async previous(): Promise<MediaControlActionResult> {
    if (this.state.queue.length === 0) {
      return {
        ok: false,
        supported: true,
        message: 'There is no previous track in the queue, Sir.',
        playbackStatus: this.state.status,
      };
    }
    if (this.state.currentIndex > 0) {
      return this.playTrackAtIndex(this.state.currentIndex - 1);
    }
    // Restart current track if at index 0
    if (this.player && this.playerReady) {
      try {
        this.player.seekTo(0, true);
        this.player.playVideo();
        this.setState({ currentTimeSec: 0, status: 'playing' });
        return {
          ok: true,
          supported: true,
          message: `Restarting ${this.state.currentTrack?.title || 'current track'}, Sir.`,
          playbackStatus: 'playing',
        };
      } catch {
        // Fall through
      }
    }
    return {
      ok: false,
      supported: true,
      message: 'Already at the first track in the queue, Sir.',
      playbackStatus: this.state.status,
    };
  }

  stop(): MediaControlActionResult {
    this.clearAutoplayWatchdog();
    if (this.player && this.playerReady) {
      try {
        this.player.stopVideo();
      } catch {
        // Ignore stop errors
      }
    }
    this.setState({
      status: 'stopped',
      currentTimeSec: 0,
      statusMessage: 'Playback stopped.',
    });
    return {
      ok: true,
      supported: true,
      message: 'Playback stopped, Sir.',
      playbackStatus: 'stopped',
    };
  }

  closePlayer(): MediaControlActionResult {
    this.playerEpoch += 1;
    this.playerInitializing = false;
    this.clearAutoplayWatchdog();
    this.stopProgressPolling();
    this.duckCount = 0;
    this.duckRestoreVolume = null;
    if (this.player) {
      try {
        this.player.stopVideo();
        this.player.destroy();
      } catch {
        // Ignore destroy errors
      }
      this.player = null;
      this.playerReady = false;
    }
    this.pendingVideoId = null;
    this.setState({
      status: 'idle',
      isPlayerVisible: false,
      isDucked: false,
      currentTimeSec: 0,
      statusMessage: 'Player closed.',
      errorMessage: null,
    });
    return {
      ok: true,
      supported: true,
      message: 'Media player closed, Sir.',
      playbackStatus: 'idle',
    };
  }

  setVolume(level: number): MediaControlActionResult {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    if (this.state.isDucked) {
      // Keep restore volume synchronized with user's explicit volume update while ducked
      this.duckRestoreVolume = clamped;
    }
    this.setState({ volume: clamped, isMuted: clamped === 0 });
    if (this.player && this.playerReady) {
      const applied = this.applyCurrentVolumeToPlayer();
      if (!applied) {
        return {
          ok: false,
          supported: false,
          message:
            'Your browser restricts programmatic YouTube volume control. Please adjust your device volume instead, Sir.',
          playbackStatus: this.state.status,
        };
      }
    }
    return {
      ok: true,
      supported: true,
      message: `Volume set to ${clamped} percent, Sir.`,
      playbackStatus: this.state.status,
    };
  }

  adjustVolume(delta: number): MediaControlActionResult {
    return this.setVolume(this.state.volume + delta);
  }

  mute(): MediaControlActionResult {
    this.setState({ isMuted: true });
    if (this.player && this.playerReady) {
      try {
        this.player.mute();
      } catch {
        return {
          ok: false,
          supported: false,
          message: 'Unable to mute YouTube playback on this browser, Sir.',
          playbackStatus: this.state.status,
        };
      }
    }
    return {
      ok: true,
      supported: true,
      message: 'Media muted, Sir.',
      playbackStatus: this.state.status,
    };
  }

  unmute(): MediaControlActionResult {
    this.setState({ isMuted: false });
    if (this.player && this.playerReady) {
      try {
        this.player.unMute();
        this.applyCurrentVolumeToPlayer();
      } catch {
        return {
          ok: false,
          supported: false,
          message: 'Unable to unmute YouTube playback on this browser, Sir.',
          playbackStatus: this.state.status,
        };
      }
    }
    return {
      ok: true,
      supported: true,
      message: 'Media unmuted, Sir.',
      playbackStatus: this.state.status,
    };
  }

  seekTo(targetSeconds: number): MediaControlActionResult {
    if (!this.state.currentTrack || !this.player || !this.playerReady) {
      return {
        ok: false,
        supported: true,
        message: 'No active track is loaded to seek, Sir.',
        playbackStatus: this.state.status,
      };
    }
    const maxDur = this.state.durationSec > 0 ? this.state.durationSec : Number.MAX_SAFE_INTEGER;
    const clamped = Math.max(0, Math.min(maxDur, targetSeconds));
    try {
      this.player.seekTo(clamped, true);
      this.setState({ currentTimeSec: clamped });
      return {
        ok: true,
        supported: true,
        message: `Seeked to ${Math.floor(clamped)} seconds, Sir.`,
        playbackStatus: this.state.status,
      };
    } catch {
      return {
        ok: false,
        supported: false,
        message: 'Seeking is unavailable for this YouTube stream right now, Sir.',
        playbackStatus: this.state.status,
      };
    }
  }

  seekBy(deltaSeconds: number): MediaControlActionResult {
    if (!this.state.currentTrack || !this.player || !this.playerReady) {
      return {
        ok: false,
        supported: true,
        message: 'No active track is playing right now, Sir.',
        playbackStatus: this.state.status,
      };
    }
    let current = this.state.currentTimeSec;
    try {
      const liveTime = Number(this.player.getCurrentTime?.());
      if (Number.isFinite(liveTime)) current = liveTime;
    } catch {
      // Fallback to cached time
    }
    const target = Math.max(0, current + deltaSeconds);
    const res = this.seekTo(target);
    if (!res.ok) return res;
    const direction = deltaSeconds >= 0 ? 'forward' : 'back';
    return {
      ...res,
      message: `Skipped ${direction} ${Math.abs(deltaSeconds)} seconds, Sir.`,
    };
  }

  setRepeatMode(mode?: MediaRepeatMode): MediaControlActionResult {
    const nextMode: MediaRepeatMode =
      mode ??
      (this.state.repeatMode === 'off'
        ? 'one'
        : this.state.repeatMode === 'one'
          ? 'all'
          : 'off');
    this.setState({ repeatMode: nextMode });
    const label =
      nextMode === 'one'
        ? 'Repeat is now enabled for this track, Sir.'
        : nextMode === 'all'
          ? 'Queue repeat is now enabled, Sir.'
          : 'Repeat is now turned off, Sir.';
    return {
      ok: true,
      supported: true,
      message: label,
      playbackStatus: this.state.status,
    };
  }

  async toggleFullscreen(explicitEnable?: boolean): Promise<MediaControlActionResult> {
    if (typeof document === 'undefined' || !this.containerEl || !this.state.currentTrack) {
      return {
        ok: false,
        supported: false,
        message: 'Load a YouTube video first before toggling fullscreen, Sir.',
        playbackStatus: this.state.status,
      };
    }

    const wantEnable =
      typeof explicitEnable === 'boolean' ? explicitEnable : !this.state.isFullscreen;

    try {
      if (!wantEnable) {
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        }
        this.setState({ isFullscreen: false });
        return {
          ok: true,
          supported: true,
          message: 'Exited fullscreen mode, Sir.',
          playbackStatus: this.state.status,
        };
      }

      const targetEl =
        (this.containerEl.querySelector('iframe') as HTMLElement | null) || this.containerEl;
      const fsTarget = targetEl as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };

      if (typeof fsTarget.requestFullscreen === 'function') {
        await fsTarget.requestFullscreen();
      } else if (typeof fsTarget.webkitRequestFullscreen === 'function') {
        await fsTarget.webkitRequestFullscreen();
      } else {
        return {
          ok: false,
          supported: false,
          message: 'Fullscreen API is not supported by this browser, Sir.',
          playbackStatus: this.state.status,
        };
      }

      this.setState({ isFullscreen: true });
      return {
        ok: true,
        supported: true,
        message: 'Fullscreen mode enabled, Sir.',
        playbackStatus: this.state.status,
      };
    } catch {
      return {
        ok: false,
        supported: false,
        message:
          'Your browser requires a direct click on the Fullscreen button to enter fullscreen mode, Sir.',
        playbackStatus: this.state.status,
      };
    }
  }

  /**
   * Audio Ducking: Lowers supported YouTube IFrame volume to ~20% while JARVIS speaks or listens,
   * and restores previous volume cleanly when speech/capture finishes.
   */
  beginAudioDuck(duckLevel = 20): boolean {
    if (this.state.status !== 'playing' && this.state.status !== 'loading') {
      return false;
    }
    this.duckCount += 1;
    this.activeDuckLevel = Math.max(0, Math.min(100, Math.round(duckLevel)));
    if (this.state.isDucked) return this.state.duckingSupported;
    this.duckRestoreVolume = this.state.volume;
    this.setState({ isDucked: true });
    if (this.player && this.playerReady && !this.state.isMuted) {
      try {
        this.player.setVolume(Math.min(this.state.volume, this.activeDuckLevel));
        return true;
      } catch {
        this.setState({ duckingSupported: false });
        return false;
      }
    }
    return this.state.duckingSupported;
  }

  endAudioDuck(): void {
    if (this.duckCount > 0) {
      this.duckCount -= 1;
    }
    if (this.duckCount > 0 || !this.state.isDucked) return;
    // Restore to the latest authoritative user volume (respecting any volume changes made while ducked)
    const restoreTo = this.state.volume ?? this.duckRestoreVolume ?? 80;
    this.duckRestoreVolume = null;
    this.setState({ isDucked: false });
    if (this.player && this.playerReady && !this.state.isMuted) {
      try {
        this.player.setVolume(Math.max(0, Math.min(100, Math.round(restoreTo))));
      } catch {
        // Ignore browser restriction
      }
    }
  }

  destroy(): void {
    this.playerEpoch += 1;
    this.playerInitializing = false;
    this.clearAutoplayWatchdog();
    this.stopProgressPolling();
    this.duckCount = 0;
    this.duckRestoreVolume = null;
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        // Ignore
      }
      this.player = null;
      this.playerReady = false;
    }
    if (this.fullscreenListenerBound && typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
      this.fullscreenListenerBound = false;
    }
    this.listeners.clear();
  }
}
