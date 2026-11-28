package com.example.ui.components

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

class YouTubePlayerBridge(
    private val mainHandler: Handler,
    private val onStateChanged: (Int) -> Unit,
    private val onProgress: (Int, Int) -> Unit,
    private val onError: (Int) -> Unit
) {
    @JavascriptInterface
    fun onPlayerState(stateCode: Int) {
        mainHandler.post { onStateChanged(stateCode) }
    }

    @JavascriptInterface
    fun onPlayerProgress(curSec: Int, durSec: Int) {
        mainHandler.post { onProgress(curSec, durSec) }
    }

    @JavascriptInterface
    fun onPlayerError(errorCode: Int) {
        mainHandler.post { onError(errorCode) }
    }
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
fun YouTubeIFrameWebView(
    initialVideoId: String?,
    onWebViewReady: (WebView) -> Unit,
    onStateChanged: (Int) -> Unit,
    onProgress: (Int, Int) -> Unit,
    onError: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val latestOnStateChanged by rememberUpdatedState(onStateChanged)
    val latestOnProgress by rememberUpdatedState(onProgress)
    val latestOnError by rememberUpdatedState(onError)

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { ctx ->
            val playerBridge = YouTubePlayerBridge(
                mainHandler = mainHandler,
                onStateChanged = { latestOnStateChanged(it) },
                onProgress = { cur, dur -> latestOnProgress(cur, dur) },
                onError = { latestOnError(it) }
            )
            WebView(ctx).apply {
                setBackgroundColor(android.graphics.Color.BLACK)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                addJavascriptInterface(playerBridge, "JarvisAndroidYT")

                val safeInitial = (initialVideoId ?: "").replace(Regex("[^A-Za-z0-9_-]"), "")
                val html = buildOfficialYouTubeIFrameHtml(safeInitial)
                loadDataWithBaseURL(
                    "https://www.youtube-nocookie.com",
                    html,
                    "text/html",
                    "UTF-8",
                    null
                )
                onWebViewReady(this)
            }
        }
    )
}

fun buildOfficialYouTubeIFrameHtml(initialVideoId: String): String {
    return """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
          <style>
            html, body, #player { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
          </style>
        </head>
        <body>
          <div id="player"></div>
          <script src="https://www.youtube.com/iframe_api"></script>
          <script>
            var ytPlayer = null;
            var ytReady = false;
            var queuedVideo = "$initialVideoId";
            var queuedAutoPlay = true;
            var progressTimer = null;

            function onYouTubeIframeAPIReady() {
              ytPlayer = new YT.Player('player', {
                width: '100%',
                height: '100%',
                videoId: queuedVideo || undefined,
                playerVars: {
                  autoplay: queuedVideo ? 1 : 0,
                  playsinline: 1,
                  rel: 0,
                  modestbranding: 1,
                  enablejsapi: 1
                },
                events: {
                  onReady: function() {
                    ytReady = true;
                    if (queuedVideo) {
                      if (queuedAutoPlay) ytPlayer.loadVideoById(queuedVideo);
                      else ytPlayer.cueVideoById(queuedVideo);
                    }
                    if (!progressTimer) {
                      progressTimer = setInterval(function() {
                        if (ytReady && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                          var cur = Math.floor(ytPlayer.getCurrentTime() || 0);
                          var dur = Math.floor(ytPlayer.getDuration() || 0);
                          JarvisAndroidYT.onPlayerProgress(cur, dur);
                        }
                      }, 1000);
                    }
                  },
                  onStateChange: function(e) {
                    JarvisAndroidYT.onPlayerState(e.data);
                  },
                  onError: function(e) {
                    JarvisAndroidYT.onPlayerError(e.data);
                  }
                }
              });
            }

            window.jarvisLoadVideo = function(videoId, autoPlay) {
              queuedVideo = videoId;
              queuedAutoPlay = !!autoPlay;
              if (ytReady && ytPlayer) {
                if (queuedAutoPlay) ytPlayer.loadVideoById(videoId);
                else ytPlayer.cueVideoById(videoId);
              }
            };
            window.jarvisPlay = function() { if (ytReady && ytPlayer) ytPlayer.playVideo(); };
            window.jarvisPause = function() { if (ytReady && ytPlayer) ytPlayer.pauseVideo(); };
            window.jarvisStop = function() { if (ytReady && ytPlayer) ytPlayer.stopVideo(); };
            window.jarvisSeekBy = function(delta) {
              if (ytReady && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                var next = Math.max(0, (ytPlayer.getCurrentTime() || 0) + delta);
                ytPlayer.seekTo(next, true);
              }
            };
            window.jarvisSeekTo = function(sec) { if (ytReady && ytPlayer) ytPlayer.seekTo(Math.max(0, sec), true); };
            window.jarvisSetVolume = function(lvl) {
              if (ytReady && ytPlayer) {
                ytPlayer.unMute();
                ytPlayer.setVolume(Math.max(0, Math.min(100, lvl)));
              }
            };
            window.jarvisMute = function() { if (ytReady && ytPlayer) ytPlayer.mute(); };
            window.jarvisUnmute = function() { if (ytReady && ytPlayer) ytPlayer.unMute(); };
            window.jarvisSetPlaybackRate = function(rate) {
              if (ytReady && ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
                ytPlayer.setPlaybackRate(rate);
              }
            };
          </script>
        </body>
        </html>
    """.trimIndent()
}
