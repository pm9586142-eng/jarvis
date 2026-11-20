import {
  AiStructuredAction,
  CommandActivityLogEntry,
  CommandSource,
  ParsedUniversalCommand,
  SmartMediaMemory,
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
    allowAiActionFallback?: boolean;
    tryExistingLocalCommand?: (rawText: string) => boolean;
  }): Promise<CommandExecutionOutcome> {
    const parsed = this.router.route(params.rawText);

    // Stages 1..5 handled directly here
    if (parsed.intent !== 'UNKNOWN_COMMAND') {
      return this.executeParsedCommand(parsed, params.source, params.memory);
    }

    // Stage 6: Delegate to existing registered JARVIS local & Multi-AI Brain commands
    if (params.tryExistingLocalCommand && params.tryExistingLocalCommand(params.rawText)) {
      return {
        handled: true,
        intent: 'UNKNOWN_COMMAND',
        status: 'success',
      };
    }

    // Stage 7: Optional Whitelisted Structured AI Fallback (only for voice/media bar commands,
    // leaving normal conversational chat free to flow into the existing Multi-AI Brain stream!)
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
        return this.executeValidatedAiAction(aiAction, params.rawText, params.source, params.memory);
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
    memory: SmartMediaMemory
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
        memory
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
        memory
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
        memory
      );
    }

    // Whitelisted media_control action
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
      current: { intent: 'GET_CURRENT_MEDIA', rawText, normalizedText: rawText, confidence: 0.85 },
    };

    const mapped = cmdMap[action.command];
    if (!mapped) {
      return { handled: false, intent: 'UNKNOWN_COMMAND', status: 'error' };
    }
    return this.executeParsedCommand(mapped, source, memory);
  }

  private async executeParsedCommand(
    parsed: ParsedUniversalCommand,
    source: CommandSource,
    memory: SmartMediaMemory
  ): Promise<CommandExecutionOutcome> {
    let updatedMemory = this.memoryService.recordCommand(memory, parsed.rawText, parsed.intent);

    switch (parsed.intent) {
      case 'OPEN_WEBSITE': {
        const target = parsed.websiteTarget || parsed.query || '';
        const launchRes = await this.websiteLauncher.launch(target);
        const { resolved, opened, popupBlocked, error } = launchRes;

        if (!resolved.ok || !resolved.url) {
          const msg = error || 'That URL was blocked for security reasons, Sir.';
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
          const spoken = `I resolved ${resolved.label}, Sir, but your browser blocked the automatic popup. Please click the direct link in the activity log or allow popups for this site.`;
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
          ? `I could not match an exact official domain, Sir. Opening Google Search for ${target}.`
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
          const spoken = `Your browser blocked the Google search popup for ${query}, Sir. Click the search link in the activity log.`;
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
          spokenReply: `Searching Google for ${query}, Sir.`,
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

      case 'PLAY_SONG':
      case 'PLAY_PLAYLIST':
      case 'PLAY_VIDEO': {
        const isMusic = parsed.intent === 'PLAY_SONG' || parsed.intent === 'PLAY_PLAYLIST';
        const query = parsed.query || parsed.songName || parsed.normalizedText;
        updatedMemory = { ...updatedMemory, lastSearchQuery: query, updatedAt: Date.now() };
        this.memoryService.save(updatedMemory);

        const searchRes = isMusic
          ? await this.musicSearch.searchMusic({
              query,
              songName: parsed.songName,
              artistName: parsed.artistName,
              isPlaylist: parsed.intent === 'PLAY_PLAYLIST',
              maxResults: 5,
            })
          : await this.videoSearch.searchVideos(query, 5);

        if (!searchRes.ok || searchRes.items.length === 0) {
          const openRes = this.browserActions.openUrl(searchRes.fallbackUrl);
          const baseReason =
            searchRes.reason ||
            (!searchRes.configured
              ? 'YouTube Search API is not configured on the server.'
              : `No embeddable YouTube results were found for "${query}".`);
          this.playback.setFallbackOnly(searchRes.fallbackUrl, baseReason);

          const spoken = openRes.opened
            ? `${baseReason} I have opened YouTube search results for ${query} in a new tab, Sir.`
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

        const isAmbiguous = detectAmbiguousVideoMatches(
          query,
          searchRes.items,
          isMusic ? 'music' : 'video'
        );

        if (isAmbiguous) {
          this.playback.setPendingSelection(query, searchRes.items, searchRes.fallbackUrl);
          const spoken = `I found ${searchRes.items.length} relevant videos for ${query}, Sir. Please select which one you would like me to play.`;
          return {
            handled: true,
            intent: parsed.intent,
            status: 'clarification',
            spokenReply: spoken,
            chatReply: `Found **${searchRes.items.length}** YouTube results for **${query}**. Open the Media Control HUD to pick one.`,
            openMediaView: true,
            updatedMemory,
            activityEntry: this.createLogEntry(source, parsed, {
              status: 'clarification',
              summary: `Loaded ${searchRes.items.length} results for "${query}" awaiting selection.`,
              url: searchRes.fallbackUrl,
              urlLabel: `YouTube: ${query}`,
              resultsCount: searchRes.items.length,
            }),
          };
        }

        const top = searchRes.items[0];
        await this.playback.loadQueue(searchRes.items, 0, {
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
        const spoken = `Certainly, Sir. Loading ${shortTitle}.`;
        const chat = `**Now Loading in J.A.R.V.I.S. Media HUD**\n- **Title:** ${top.title}\n- **Channel / Artist:** ${top.channelTitle}${
          top.durationText ? `\n- **Duration:** ${top.durationText}` : ''
        }\n- **Queue Loaded:** ${searchRes.items.length} tracks\n- **YouTube Link:** [Watch on YouTube](${top.watchUrl})`;

        return {
          handled: true,
          intent: parsed.intent,
          status: 'success',
          spokenReply: spoken,
          chatReply: chat,
          updatedMemory,
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
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'RESUME_MEDIA': {
        const r = this.playback.play();
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
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
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
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
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'STOP_MEDIA': {
        const r = this.playback.stop();
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'CLOSE_PLAYER': {
        const r = this.playback.closePlayer();
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
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
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'MUTE_MEDIA': {
        const r = this.playback.mute();
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'UNMUTE_MEDIA': {
        const r = this.playback.unmute();
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'SEEK_FORWARD': {
        const r = this.playback.seekBy(parsed.seekSeconds ?? 10);
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'SEEK_BACKWARD': {
        const r = this.playback.seekBy(-(parsed.seekSeconds ?? 10));
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'REPEAT_MEDIA': {
        const r = this.playback.setRepeatMode(parsed.repeatEnabled === false ? 'off' : 'one');
        return this.wrapMediaControlOutcome(parsed, source, r, updatedMemory);
      }

      case 'GET_CURRENT_MEDIA': {
        const state = this.playback.getState();
        const active = state.currentTrack || updatedMemory.currentTrack;
        if (!active || state.status === 'idle') {
          const msg = 'Nothing is currently playing in the media player, Sir.';
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
        const msg = parsed.isWhoSingingQuestion
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
