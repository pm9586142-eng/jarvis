import {
  AiStructuredAction,
  CommandActivityLogEntry,
  CommandSource,
  ParsedUniversalCommand,
  SmartMediaMemory,
  YouTubeMediaItem,
  YouTubeSearchResponse,
} from '../../types/media';
import {
  MediaCommandRegistry,
  UniversalCommandRouter,
} from './universalCommandRouter.js';
import {
  BrowserActionService,
  WebsiteLauncher,
  WebsiteResolver,
  WebSearchService,
} from './websiteResolver.js';
import {
  detectAmbiguousVideoMatches,
  MusicSearchService,
  requestStructuredAiActionFromBackend,
  SmartMediaMemoryService,
  VideoSearchService,
  YouTubeSearchService,
} from './youtubeMediaServices';
import { MediaPlaybackController } from './mediaPlaybackController';

export interface CommandExecutionOutcome {
  handled: boolean;
  intent: ParsedUniversalCommand['intent'];
  status: CommandActivityLogEntry['status'];
  spokenReply?: string;
  chatReply?: string;
  activityEntry?: CommandActivityLogEntry;
  openMediaView?: boolean;
  updatedMemory?: SmartMediaMemory;
  searchResult?: YouTubeSearchResponse;
}

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

function shouldRespondInHindi(rawText: string, uiLanguage?: string): boolean {
  return DEVANAGARI_REGEX.test(rawText) || uiLanguage === 'HINDI';
}

export class VoiceCommandExecutor {
  public readonly registry: MediaCommandRegistry;
  public readonly router: UniversalCommandRouter;
  public readonly browserActions: BrowserActionService;
  public readonly websiteResolver: WebsiteResolver;
  public readonly websiteLauncher: WebsiteLauncher;
  public readonly webSearch: WebSearchService;
  public readonly youtubeSearch: YouTubeSearchService;
  public readonly videoSearch: VideoSearchService;
  public readonly musicSearch: MusicSearchService;
  public readonly memoryService: SmartMediaMemoryService;

  private lastExecutedKey = '';
  private lastExecutedAt = 0;

  constructor(private playback: MediaPlaybackController) {
    this.registry = new MediaCommandRegistry();
    this.router = new UniversalCommandRouter(this.registry);
    this.browserActions = new BrowserActionService();
    this.websiteResolver = new WebsiteResolver({
      aiResolveFn: (target) =>
        requestStructuredAiActionFromBackend({
          message: target,
          mode: 'resolve_website',
        }),
    });
    this.websiteLauncher = new WebsiteLauncher(this.websiteResolver, this.browserActions);
    this.webSearch = new WebSearchService(this.browserActions);
    this.youtubeSearch = new YouTubeSearchService();
    this.videoSearch = new VideoSearchService(this.youtubeSearch);
    this.musicSearch = new MusicSearchService(this.youtubeSearch);
    this.memoryService = new SmartMediaMemoryService();
  }

  private createLogEntry(
    source: CommandSource,
    parsed: ParsedUniversalCommand,
    params: {
      status: CommandActivityLogEntry['status'];
      summary: string;
      url?: string;
      urlLabel?: string;
      resultsCount?: number;
      errorDetail?: string;
    }
  ): CommandActivityLogEntry {
    return {
      id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      source,
      rawCommand: parsed.rawText,
      normalizedCommand: parsed.normalizedText,
      intent: parsed.intent,
      status: params.status,
      summary: params.summary,
      url: params.url,
      urlLabel: params.urlLabel,
      resultsCount: params.resultsCount,
      playbackStatus: this.playback.getState().status,
      errorDetail: params.errorDetail,
    };
  }

  async execute(params: {
    rawText: string;
    source: CommandSource;
    memory: SmartMediaMemory;
    uiLanguage?: string;
    allowAiActionFallback?: boolean;
    tryExistingLocalCommand?: (rawText: string) => boolean;
  }): Promise<CommandExecutionOutcome> {
    const parsed = this.router.route(params.rawText);

    // Prevent accidental duplicate voice command execution (e.g. duplicate SpeechRecognition finals within 1.2s)
    const dedupeKey = `${params.source}::${parsed.intent}::${parsed.normalizedText.toLowerCase()}`;
    const now = Date.now();
    if (
      parsed.intent !== 'UNKNOWN_COMMAND' &&
      dedupeKey === this.lastExecutedKey &&
      now - this.lastExecutedAt < 1200
    ) {
      return {
        handled: true,
        intent: parsed.intent,
        status: 'success',
      };
    }

    // Stages 1..5 handled directly here
    if (parsed.intent !== 'UNKNOWN_COMMAND') {
      this.lastExecutedKey = dedupeKey;
      this.lastExecutedAt = now;
      return this.executeParsedCommand(parsed, params.source, params.memory, params.uiLanguage);
    }

    // Stage 6: Delegate to existing registered JARVIS local & Multi-AI Brain commands
    if (params.tryExistingLocalCommand && params.tryExistingLocalCommand(params.rawText)) {
      return {
        handled: true,
        intent: 'UNKNOWN_COMMAND',
        status: 'success',
      };
    }

    // Stage 7: Optional Whitelisted Structured AI Fallback
    if (params.allowAiActionFallback) {
      const state = this.playback.getState();
      const aiAction = await requestStructuredAiActionFromBackend({
        message: params.rawText,
        mode: 'media_fallback',
        mediaContext: {
          currentTitle: state.currentTrack?.title || null,
          currentArtist: state.currentTrack?.channelTitle || null,
          status: state.status,
          queueLength: state.queue.length,
          lastOpenedWebsite: params.memory.lastOpenedWebsite?.label || null,
        },
      });

      if (aiAction) {
        return this.executeValidatedAiAction(
          aiAction,
          params.rawText,
          params.source,
          params.memory,
          params.uiLanguage
        );
      }
    }

    return {
      handled: false,
      intent: 'UNKNOWN_COMMAND',
      status: 'fallback',
    };
  }

  private async executeValidatedAiAction(
    action: AiStructuredAction,
    rawText: string,
    source: CommandSource,
    memory: SmartMediaMemory,
    uiLanguage?: string
  ): Promise<CommandExecutionOutcome> {
    if (action.action === 'clarify') {
      const parsed: ParsedUniversalCommand = {
        intent: 'UNKNOWN_COMMAND',
        rawText,
        normalizedText: rawText,
        confidence: 0.5,
      };
      return {
        handled: true,
        intent: 'UNKNOWN_COMMAND',
        status: 'clarification',
        spokenReply: action.question,
        chatReply: action.question,
        activityEntry: this.createLogEntry(source, parsed, {
          status: 'clarification',
          summary: action.question,
        }),
      };
    }

    if (action.action === 'open_url') {
      return this.executeParsedCommand(
        {
          intent: 'OPEN_WEBSITE',
          rawText,
          normalizedText: rawText,
          websiteTarget: action.url,
          query: action.label || action.url,
          confidence: 0.85,
          matchedRule: 'ai_fallback_open_url',
        },
        source,
        memory,
        uiLanguage
      );
    }

    if (action.action === 'play_song') {
      return this.executeParsedCommand(
        {
          intent: 'PLAY_SONG',
          rawText,
          normalizedText: rawText,
          query: action.query,
          confidence: 0.85,
          matchedRule: 'ai_fallback_play_song',
        },
        source,
        memory,
        uiLanguage
      );
    }

    if (action.action === 'play_video') {
      return this.executeParsedCommand(
        {
          intent: 'PLAY_VIDEO',
          rawText,
          normalizedText: rawText,
          query: action.query,
          confidence: 0.85,
          matchedRule: 'ai_fallback_play_video',
        },
        source,
        memory,
        uiLanguage
      );
    }

    const cmdMap: Record<string, ParsedUniversalCommand> = {
      play: { intent: 'RESUME_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      resume: { intent: 'RESUME_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      pause: { intent: 'PAUSE_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      next: { intent: 'NEXT_TRACK', rawText, normalizedText: rawText, confidence: 0.85 },
      previous: { intent: 'PREVIOUS_TRACK', rawText, normalizedText: rawText, confidence: 0.85 },
      stop: { intent: 'STOP_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      close: { intent: 'CLOSE_PLAYER', rawText, normalizedText: rawText, confidence: 0.85 },
      volume_up: { intent: 'CHANGE_VOLUME', rawText, normalizedText: rawText, volumeDelta: 15, confidence: 0.85 },
      volume_down: { intent: 'CHANGE_VOLUME', rawText, normalizedText: rawText, volumeDelta: -15, confidence: 0.85 },
      set_volume: {
        intent: 'CHANGE_VOLUME',
        rawText,
        normalizedText: rawText,
        volumeLevel: action.value ?? 50,
        confidence: 0.85,
      },
      mute: { intent: 'MUTE_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      unmute: { intent: 'UNMUTE_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
      seek_forward: {
        intent: 'SEEK_FORWARD',
        rawText,
        normalizedText: rawText,
        seekSeconds: action.value ?? 10,
        confidence: 0.85,
      },
      seek_backward: {
        intent: 'SEEK_BACKWARD',
        rawText,
        normalizedText: rawText,
        seekSeconds: action.value ?? 10,
        confidence: 0.85,
      },
      repeat: { intent: 'REPEAT_MEDIA', rawText, normalizedText: rawText, repeatEnabled: true, confidence: 0.85 },
      fullscreen: { intent: 'TOGGLE_FULLSCREEN', rawText, normalizedText: rawText, fullscreenEnabled: true, confidence: 0.85 },
      current: { intent: 'GET_CURRENT_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
    };

    const mapped = cmdMap[action.command];
    if (!mapped) {
      return { handled: false, intent: 'UNKNOWN_COMMAND', status: 'error' };
    }
    return this.executeParsedCommand(mapped, source, memory, uiLanguage);
  }

  private async executeParsedCommand(
    parsed: ParsedUniversalCommand,
    source: CommandSource,
    memory: SmartMediaMemory,
    uiLanguage?: string
  ): Promise<CommandExecutionOutcome> {
    const hi = shouldRespondInHindi(parsed.rawText, uiLanguage);
    let updatedMemory = this.memoryService.recordCommand(memory, parsed.rawText, parsed.intent);

    switch (parsed.intent) {
      case 'OPEN_WEBSITE': {
        const target = parsed.websiteTarget || parsed.query || '';
        const launchRes = await this.websiteLauncher.launch(target);
        const { resolved, opened, popupBlocked, error } = launchRes;

        if (!resolved.ok || !resolved.url) {
          const msg =
            error ||
            (hi
              ? 'सुरक्षा कारणों से यह लिंक ब्लॉक कर दिया गया है।'
              : 'That URL was blocked for security reasons, Sir.');
          return {
            handled: true,
            intent: parsed.intent,
            status: 'error',
            spokenReply: msg,
            chatReply: `**Security Guard:** ${msg}`,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'error',
              summary: msg,
              errorDetail: error,
            }),
          };
        }

        updatedMemory = {
          ...updatedMemory,
          lastOpenedWebsite: {
            label: resolved.label,
            url: resolved.url,
            timestamp: Date.now(),
          },
          updatedAt: Date.now(),
        };
        this.memoryService.save(updatedMemory);

        if (popupBlocked || !opened) {
          const spoken = hi
            ? `${resolved.label} मिल गया है, लेकिन ब्राउज़र ने पॉपअप ब्लॉक कर दिया। कृपया नीचे दिए गए लिंक पर क्लिक करें।`
            : `I resolved ${resolved.label}, Sir, but your browser blocked the automatic popup. Please click the direct link in the activity log or allow popups for this site.`;
          const chat = `**Popup Blocked by Browser**\nI resolved **${resolved.label}**, but the browser blocked opening a new tab automatically.\n- Direct Link: [${resolved.label}](${resolved.url})\n- Tip: Allow popups for this site in your browser address bar to enable instant voice launching.`;
          return {
            handled: true,
            intent: parsed.intent,
            status: 'popup_blocked',
            spokenReply: spoken,
            chatReply: chat,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'popup_blocked',
              summary: `Popup blocked while opening ${resolved.label}. Click link to open manually.`,
              url: resolved.url,
              urlLabel: resolved.label,
              errorDetail: error,
            }),
          };
        }

        const spoken = resolved.isFallbackSearch
          ? hi
            ? `${target} के लिए गूगल सर्च खोल रही हूँ।`
            : `I could not match an exact official domain, Sir. Opening Google Search for ${target}.`
          : hi
            ? `${resolved.label} खोल रही हूँ।`
            : `Opening ${resolved.label}, Sir.`;
        const chat = resolved.isFallbackSearch
          ? `Opened Google Search fallback for **${target}**: [${resolved.label}](${resolved.url})`
          : `Opening **${resolved.label}**, Sir.\n- Link: [${resolved.url}](${resolved.url})`;

        return {
          handled: true,
          intent: parsed.intent,
          status: resolved.isFallbackSearch ? 'fallback' : 'success',
          spokenReply: spoken,
          chatReply: chat,
          updatedMemory,
          activityEntry: this.createLogEntry(source, parsed, {
            status: resolved.isFallbackSearch ? 'fallback' : 'success',
            summary: `Opened ${resolved.label} (${resolved.source.replace('_', ' ')}).`,
            url: resolved.url,
            urlLabel: resolved.label,
          }),
        };
      }

      case 'SEARCH_WEB': {
        const query = parsed.query || parsed.normalizedText;
        const res = this.webSearch.searchGoogle(query);
        updatedMemory = { ...updatedMemory, lastSearchQuery: query, updatedAt: Date.now() };
        this.memoryService.save(updatedMemory);

        if (res.popupBlocked || !res.opened) {
          const spoken = hi
            ? `${query} के लिए गूगल सर्च पॉपअप ब्लॉक हो गया है। कृपया एक्टिविटी लॉग के लिंक पर क्लिक करें।`
            : `Your browser blocked the Google search popup for ${query}, Sir. Click the search link in the activity log.`;
          return {
            handled: true,
            intent: parsed.intent,
            status: 'popup_blocked',
            spokenReply: spoken,
            chatReply: `**Popup Blocked:** Click to search Google for **${query}**: [Open Google Search](${res.url})`,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'popup_blocked',
              summary: `Popup blocked for Google search "${query}".`,
              url: res.url,
              urlLabel: `Google: ${query}`,
              errorDetail: res.error,
            }),
          };
        }

        return {
          handled: true,
          intent: parsed.intent,
          status: 'success',
          spokenReply: hi ? `${query} के लिए गूगल पर खोज रही हूँ।` : `Searching Google for ${query}, Sir.`,
          chatReply: `Opened Google Search for **${query}**: [View Results](${res.url})`,
          updatedMemory,
          activityEntry: this.createLogEntry(source, parsed, {
            status: 'success',
            summary: `Opened Google search for "${query}".`,
            url: res.url,
            urlLabel: `Google: ${query}`,
          }),
        };
      }

      case 'SEARCH_YOUTUBE': {
        const query = parsed.query || parsed.normalizedText;
        const mode = parsed.searchMode || 'video';
        updatedMemory = this.memoryService.recordSearchHistory(updatedMemory, query, mode);

        const searchRes = await this.youtubeSearch.search({ query, mode, maxResults: 8 });

        if (!searchRes.ok || searchRes.items.length === 0) {
          const baseReason =
            searchRes.reason ||
            (!searchRes.configured
              ? 'YouTube Search API (YOUTUBE_API_KEY) is not configured on the server.'
              : `No embeddable YouTube videos were found for "${query}".`);
          this.playback.setFallbackOnly(searchRes.fallbackUrl, baseReason);

          const spoken = hi
            ? `${query} के लिए यूट्यूब परिणाम अभी उपलब्ध नहीं हो पाए। मैंने यूट्यूब सर्च लिंक तैयार कर दिया है।`
            : `${baseReason} I placed a direct YouTube search link in the player panel.`;

          return {
            handled: true,
            intent: parsed.intent,
            status: 'fallback',
            spokenReply: spoken,
            chatReply: `**YouTube Search**\n${baseReason}\n- Direct Link: [Search "${query}" on YouTube](${searchRes.fallbackUrl})`,
            openMediaView: true,
            updatedMemory,
            searchResult: searchRes,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'fallback',
              summary: `${baseReason} Fallback search for "${query}".`,
              url: searchRes.fallbackUrl,
              urlLabel: `YouTube Search: ${query}`,
              resultsCount: 0,
              errorDetail: searchRes.code,
            }),
          };
        }

        this.playback.setPendingSelection(query, searchRes.items, searchRes.fallbackUrl);
        updatedMemory = {
          ...updatedMemory,
          queue: searchRes.items,
          updatedAt: Date.now(),
        };
        this.memoryService.save(updatedMemory);

        const spoken = hi
          ? `आपके लिए वीडियो खोज रही हूँ। ${searchRes.items.length} यूट्यूब परिणाम मिल गए हैं। पहला वीडियो चलाने के लिए कहें पहला वीडियो चलाओ।`
          : `Searching YouTube for you. Found ${searchRes.items.length} videos for ${query}. Say "Play the first video" or tap any result.`;

        const chat = `**YouTube Search Results for "${query}"** (${searchRes.items.length} found)\n${searchRes.items
          .slice(0, 5)
          .map((item, i) => `${i + 1}. **${item.title}** — ${item.channelTitle}${item.durationText ? ` (${item.durationText})` : ''}`)
          .join('\n')}`;

        return {
          handled: true,
          intent: parsed.intent,
          status: 'success',
          spokenReply: spoken,
          chatReply: chat,
          openMediaView: true,
          updatedMemory,
          searchResult: searchRes,
          activityEntry: this.createLogEntry(source, parsed, {
            status: 'success',
            summary: `Found ${searchRes.items.length} YouTube results for "${query}".`,
            url: searchRes.fallbackUrl,
            urlLabel: `YouTube: ${query}`,
            resultsCount: searchRes.items.length,
          }),
        };
      }

      case 'SELECT_MEDIA_INDEX': {
        const idx = typeof parsed.selectIndex === 'number' ? parsed.selectIndex : 0;
        const state = this.playback.getState();
        if (state.queue.length === 0) {
          const msg = hi
            ? 'अभी कोई वीडियो सूची तैयार नहीं है। पहले यूट्यूब पर कुछ खोजें।'
            : 'There are no YouTube search results loaded yet, Sir. Ask me to search YouTube first.';
          return {
            handled: true,
            intent: parsed.intent,
            status: 'error',
            spokenReply: msg,
            chatReply: msg,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'error',
              summary: msg,
            }),
          };
        }
        const r = await this.playback.playTrackAtIndex(idx);
        const nextState = this.playback.getState();
        if (r.ok && nextState.currentTrack) {
          updatedMemory = {
            ...updatedMemory,
            previousTrack: nextState.previousTrack,
            currentTrack: nextState.currentTrack,
            updatedAt: Date.now(),
          };
          this.memoryService.save(updatedMemory);
        }
        const spoken = r.ok
          ? hi
            ? `आपका चुना हुआ वीडियो चला रही हूँ।`
            : `Playing your selected video: ${nextState.currentTrack?.title.slice(0, 64) || ''}.`
          : r.message;
        return {
          handled: true,
          intent: parsed.intent,
          status: r.ok ? 'success' : 'error',
          spokenReply: spoken,
          chatReply: r.ok
            ? `Playing **${nextState.currentTrack?.title || 'selected video'}** (${nextState.currentTrack?.channelTitle || 'YouTube'}).`
            : r.message,
          openMediaView: r.ok,
          updatedMemory,
          activityEntry: this.createLogEntry(source, parsed, {
            status: r.ok ? 'success' : 'error',
            summary: spoken,
            url: nextState.currentTrack?.watchUrl,
            urlLabel: nextState.currentTrack?.title,
          }),
        };
      }

      case 'PLAY_DIFFERENT': {
        const state = this.playback.getState();
        if (state.queue.length > 1) {
          const nextIdx = (state.currentIndex + 1) % state.queue.length;
          const r = await this.playback.playTrackAtIndex(nextIdx);
          const nextState = this.playback.getState();
          if (r.ok && nextState.currentTrack) {
            updatedMemory = {
              ...updatedMemory,
              previousTrack: nextState.previousTrack,
              currentTrack: nextState.currentTrack,
              updatedAt: Date.now(),
            };
            this.memoryService.save(updatedMemory);
          }
          const spoken = hi
            ? 'दूसरा गाना चला रही हूँ।'
            : `Switching to another track: ${nextState.currentTrack?.title.slice(0, 64) || ''}.`;
          return {
            handled: true,
            intent: parsed.intent,
            status: r.ok ? 'success' : 'error',
            spokenReply: spoken,
            chatReply: spoken,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: r.ok ? 'success' : 'error',
              summary: spoken,
              url: nextState.currentTrack?.watchUrl,
              urlLabel: nextState.currentTrack?.title,
            }),
          };
        }
        // If queue has 0 or 1 item, search for a fresh track based on last query or trending music
        const freshQuery =
          parsed.searchMode === 'video'
            ? 'trending technology videos'
            : updatedMemory.lastSearchQuery
              ? `${updatedMemory.lastSearchQuery} mix`
              : 'popular Hindi Bollywood songs';
        return this.executeParsedCommand(
          {
            intent: parsed.searchMode === 'video' ? 'PLAY_VIDEO' : 'PLAY_SONG',
            rawText: parsed.rawText,
            normalizedText: freshQuery,
            query: freshQuery,
            searchMode: parsed.searchMode || 'music',
            confidence: 0.9,
            matchedRule: 'play_different_fresh_search',
          },
          source,
          updatedMemory,
          uiLanguage
        );
      }

      case 'TOGGLE_FULLSCREEN': {
        const r = await this.playback.toggleFullscreen(parsed.fullscreenEnabled);
        const spoken = r.ok
          ? hi
            ? parsed.fullscreenEnabled === false
              ? 'फुलस्क्रीन बंद कर दिया है।'
              : 'फुलस्क्रीन चालू कर दिया है।'
            : r.message
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message: spoken }, updatedMemory);
      }

      case 'PLAY_SONG':
      case 'PLAY_PLAYLIST':
      case 'PLAY_VIDEO': {
        const isMusic = parsed.intent === 'PLAY_SONG' || parsed.intent === 'PLAY_PLAYLIST';
        const mode = isMusic ? 'music' : parsed.searchMode === 'education' ? 'education' : 'video';
        const query = parsed.query || parsed.songName || parsed.normalizedText;
        updatedMemory = this.memoryService.recordSearchHistory(updatedMemory, query, mode);

        const searchRes = isMusic
          ? await this.musicSearch.searchMusic({
              query,
              songName: parsed.songName,
              artistName: parsed.artistName,
              isPlaylist: parsed.intent === 'PLAY_PLAYLIST',
              maxResults: 8,
            })
          : await this.videoSearch.searchVideos(
              query,
              8,
              mode === 'education' ? 'education' : 'video'
            );

        if (!searchRes.ok || searchRes.items.length === 0) {
          const openRes = this.browserActions.openUrl(searchRes.fallbackUrl);
          const baseReason =
            searchRes.reason ||
            (!searchRes.configured
              ? 'YouTube Search API is not configured on the server.'
              : `No embeddable YouTube results were found for "${query}".`);
          this.playback.setFallbackOnly(searchRes.fallbackUrl, baseReason);

          const spoken = openRes.opened
            ? hi
              ? `यूट्यूब पर ${query} के परिणाम नए टैब में खोल दिए हैं।`
              : `${baseReason} I have opened YouTube search results for ${query} in a new tab, Sir.`
            : hi
              ? `यूट्यूब सर्च लिंक एक्टिविटी लॉग में जोड़ दिया है।`
              : `${baseReason} Your browser blocked opening the tab automatically, so I placed a clickable YouTube search link in the activity log, Sir.`;

          const chat = `**YouTube Search Fallback**\n${baseReason}\n- Direct YouTube Search: [Watch "${query}" on YouTube](${searchRes.fallbackUrl})${
            openRes.popupBlocked
              ? '\n- Browser popup was blocked; click the link above or allow popups.'
              : ''
          }`;

          return {
            handled: true,
            intent: parsed.intent,
            status: openRes.popupBlocked ? 'popup_blocked' : 'fallback',
            spokenReply: spoken,
            chatReply: chat,
            openMediaView: source === 'media_ui',
            updatedMemory,
            searchResult: searchRes,
            activityEntry: this.createLogEntry(source, parsed, {
              status: openRes.popupBlocked ? 'popup_blocked' : 'fallback',
              summary: `${baseReason} Fallback search for "${query}".`,
              url: searchRes.fallbackUrl,
              urlLabel: `YouTube Search: ${query}`,
              resultsCount: 0,
              errorDetail: searchRes.code,
            }),
          };
        }

        const isAmbiguous = detectAmbiguousVideoMatches(query, searchRes.items, mode);

        if (isAmbiguous) {
          this.playback.setPendingSelection(query, searchRes.items, searchRes.fallbackUrl);
          const spoken = hi
            ? `${query} के लिए ${searchRes.items.length} वीडियो मिले हैं। कृपया अपनी पसंद का वीडियो चुनें।`
            : `I found ${searchRes.items.length} relevant videos for ${query}, Sir. Please select which one you would like me to play.`;
          return {
            handled: true,
            intent: parsed.intent,
            status: 'clarification',
            spokenReply: spoken,
            chatReply: `Found **${searchRes.items.length}** YouTube results for **${query}**. Open the Media Control HUD to pick one.`,
            openMediaView: true,
            updatedMemory,
            searchResult: searchRes,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'clarification',
              summary: `Loaded ${searchRes.items.length} results for "${query}" awaiting selection.`,
              url: searchRes.fallbackUrl,
              urlLabel: `YouTube: ${query}`,
              resultsCount: searchRes.items.length,
            }),
          };
        }

        // Prefer first embeddable track in queue
        const startIdx = Math.max(
          0,
          searchRes.items.findIndex((it: YouTubeMediaItem) => it.embeddable !== false)
        );
        const top = searchRes.items[startIdx] || searchRes.items[0];
        await this.playback.loadQueue(searchRes.items, startIdx, {
          autoPlay: true,
          fallbackUrl: searchRes.fallbackUrl,
        });

        updatedMemory = {
          ...updatedMemory,
          previousTrack: updatedMemory.currentTrack || updatedMemory.previousTrack,
          currentTrack: top,
          queue: searchRes.items,
          updatedAt: Date.now(),
        };
        this.memoryService.save(updatedMemory);

        const shortTitle = top.title.slice(0, 72);
        const spoken = hi
          ? isMusic
            ? `आपका गाना चला रही हूँ: ${shortTitle}।`
            : `आपका वीडियो चला रही हूँ: ${shortTitle}।`
          : `Playing your selected ${isMusic ? 'song' : 'video'}: ${shortTitle}.`;
        const chat = `**Now Loading in J.A.R.V.I.S. YouTube Player**\n- **Title:** ${top.title}\n- **Channel / Artist:** ${top.channelTitle}${
          top.durationText ? `\n- **Duration:** ${top.durationText}` : ''
        }\n- **Queue Loaded:** ${searchRes.items.length} items\n- **YouTube Link:** [Watch on YouTube](${top.watchUrl})`;

        return {
          handled: true,
          intent: parsed.intent,
          status: 'success',
          spokenReply: spoken,
          chatReply: chat,
          updatedMemory,
          searchResult: searchRes,
          activityEntry: this.createLogEntry(source, parsed, {
            status: 'success',
            summary: `Loaded "${top.title}" (${top.channelTitle}) with ${searchRes.items.length}-item queue.`,
            url: top.watchUrl,
            urlLabel: top.title,
            resultsCount: searchRes.items.length,
          }),
        };
      }

      case 'PAUSE_MEDIA': {
        const r = this.playback.pause();
        const message = r.ok ? (hi ? 'वीडियो रोक दिया है।' : 'Video paused.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'RESUME_MEDIA': {
        const r = this.playback.play();
        const message = r.ok ? (hi ? 'वीडियो फिर से चला रही हूँ।' : 'Resuming playback.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'NEXT_TRACK': {
        const r = await this.playback.next();
        const state = this.playback.getState();
        if (r.ok && state.currentTrack) {
          updatedMemory = {
            ...updatedMemory,
            previousTrack: state.previousTrack,
            currentTrack: state.currentTrack,
            updatedAt: Date.now(),
          };
          this.memoryService.save(updatedMemory);
        }
        const message = r.ok
          ? hi
            ? 'अगला वीडियो चला रही हूँ।'
            : 'Moving to the next video.'
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'PREVIOUS_TRACK': {
        const r = await this.playback.previous();
        const state = this.playback.getState();
        if (r.ok && state.currentTrack) {
          updatedMemory = {
            ...updatedMemory,
            currentTrack: state.currentTrack,
            updatedAt: Date.now(),
          };
          this.memoryService.save(updatedMemory);
        }
        const message = r.ok
          ? hi
            ? 'पिछला वीडियो चला रही हूँ।'
            : 'Moving to the previous video.'
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'STOP_MEDIA': {
        const r = this.playback.stop();
        const message = r.ok ? (hi ? 'वीडियो बंद कर दिया है।' : 'Video stopped.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'CLOSE_PLAYER': {
        const r = this.playback.closePlayer();
        const message = r.ok ? (hi ? 'प्लेयर बंद कर दिया है।' : 'Media player closed, Sir.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'CHANGE_VOLUME': {
        const r =
          typeof parsed.volumeLevel === 'number'
            ? this.playback.setVolume(parsed.volumeLevel)
            : this.playback.adjustVolume(parsed.volumeDelta ?? 15);
        if (r.ok) {
          updatedMemory = {
            ...updatedMemory,
            preferredVolume: this.playback.getState().volume,
            updatedAt: Date.now(),
          };
          this.memoryService.save(updatedMemory);
        }
        const vol = this.playback.getState().volume;
        const message = r.ok
          ? hi
            ? typeof parsed.volumeLevel === 'number'
              ? `आवाज़ ${vol} प्रतिशत कर दी है।`
              : (parsed.volumeDelta ?? 0) >= 0
                ? `आवाज़ बढ़ाकर ${vol} प्रतिशत कर दी है।`
                : `आवाज़ कम करके ${vol} प्रतिशत कर दी है।`
            : r.message
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'MUTE_MEDIA': {
        const r = this.playback.mute();
        const message = r.ok ? (hi ? 'आवाज़ बंद कर दी है।' : 'Video muted.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'UNMUTE_MEDIA': {
        const r = this.playback.unmute();
        const message = r.ok ? (hi ? 'आवाज़ चालू कर दी है।' : 'Video unmuted.') : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'SEEK_FORWARD': {
        const sec = parsed.seekSeconds ?? 10;
        const r = this.playback.seekBy(sec);
        const message = r.ok
          ? hi
            ? `${sec} सेकंड आगे बढ़ा दिया है।`
            : `Skipped forward ${sec} seconds.`
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'SEEK_BACKWARD': {
        const sec = parsed.seekSeconds ?? 10;
        const r = this.playback.seekBy(-sec);
        const message = r.ok
          ? hi
            ? `${sec} सेकंड पीछे कर दिया है।`
            : `Rewound ${sec} seconds.`
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'REPEAT_MEDIA': {
        const r = this.playback.setRepeatMode(parsed.repeatEnabled === false ? 'off' : 'one');
        const message = r.ok
          ? hi
            ? parsed.repeatEnabled === false
              ? 'रिपीट मोड बंद कर दिया है।'
              : 'इस गाने के लिए रिपीट चालू कर दिया है।'
            : r.message
          : r.message;
        return this.wrapMediaControlOutcome(parsed, source, { ...r, message }, updatedMemory);
      }

      case 'GET_CURRENT_MEDIA': {
        const state = this.playback.getState();
        const active = state.currentTrack || updatedMemory.currentTrack;
        if (!active || state.status === 'idle') {
          const msg = hi
            ? 'अभी प्लेयर में कोई गाना या वीडियो नहीं चल रहा है।'
            : 'Nothing is currently playing in the media player, Sir.';
          return {
            handled: true,
            intent: parsed.intent,
            status: 'success',
            spokenReply: msg,
            chatReply: msg,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'success',
              summary: msg,
            }),
          };
        }
        const statusWord =
          state.status === 'playing'
            ? 'Currently playing'
            : state.status === 'paused'
              ? 'Currently paused on'
              : 'Loaded track is';
        const msg = hi
          ? `अभी "${active.title}" (${active.channelTitle}) चल रहा है।`
          : parsed.isWhoSingingQuestion
            ? `This track is "${active.title}" from ${active.channelTitle}, Sir.`
            : `${statusWord} "${active.title}" by ${active.channelTitle}, Sir.`;
        return {
          handled: true,
          intent: parsed.intent,
          status: 'success',
          spokenReply: msg,
          chatReply: `**Now Playing Info:** ${msg}\n- [Open on YouTube](${active.watchUrl})`,
          updatedMemory,
          activityEntry: this.createLogEntry(source, parsed, {
            status: 'success',
            summary: msg,
            url: active.watchUrl,
            urlLabel: active.title,
          }),
        };
      }

      default:
        return {
          handled: false,
          intent: 'UNKNOWN_COMMAND',
          status: 'fallback',
        };
    }
  }

  private wrapMediaControlOutcome(
    parsed: ParsedUniversalCommand,
    source: CommandSource,
    result: { ok: boolean; supported: boolean; message: string },
    updatedMemory: SmartMediaMemory
  ): CommandExecutionOutcome {
    return {
      handled: true,
      intent: parsed.intent,
      status: result.ok ? 'success' : 'error',
      spokenReply: result.message,
      chatReply: result.message,
      updatedMemory,
      activityEntry: this.createLogEntry(source, parsed, {
        status: result.ok ? 'success' : 'error',
        summary: result.message,
        errorDetail: result.ok ? undefined : result.message,
      }),
    };
  }
}
