import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function readWebFile(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

test('AM Player cleanup completely removes circular avatar image from Web MediaControlView', () => {
  const mediaViewSrc = readWebFile('src/views/MediaControlView.tsx');
  assert.equal(
    mediaViewSrc.includes('am-player-avatar'),
    false,
    'Expected am-player-avatar image reference to be completely removed from MediaControlView.tsx'
  );
  assert.match(mediaViewSrc, /AM PLAYER/);
  assert.match(mediaViewSrc, /youtube/i);
});

test('App launches directly into Full-Screen Chat and supports edge-to-edge ChatView', () => {
  const appSrc = readWebFile('src/App.tsx');
  assert.match(appSrc, /if \(path === '\/' \|\| path === '\/chat' \|\| path === ''\) return 'chat';/);
  assert.match(appSrc, /screen === 'chat' \? '\/' : `\/\$\{screen\}`/);
  assert.match(appSrc, /onInitialize=\{?\(\) => navigateTo\('chat'\)/);
  assert.match(appSrc, /toggleSaveChatSession/);
  assert.match(appSrc, /chatMediaStageRect/);
  assert.match(appSrc, /const isFullScreenChat = activeScreen === 'chat'/);
});

test('ChatSidebar provides New Chat, Search, Saved Conversations, Chat History, Agents, and Settings', () => {
  const sidebarSrc = readWebFile('src/components/ChatSidebar.tsx');
  assert.match(sidebarSrc, /New Chat/);
  assert.match(sidebarSrc, /Search chats/);
  assert.match(sidebarSrc, /Saved Conversations/);
  assert.match(sidebarSrc, /Recent Conversations/);
  assert.match(sidebarSrc, /Chat History/);
  assert.match(sidebarSrc, /JARVIS Agent/);
  assert.match(sidebarSrc, /VERONICA Agent/);
  assert.match(sidebarSrc, /DUM-E Agent/);
  assert.match(sidebarSrc, /Settings/);
  assert.match(sidebarSrc, /overflow-y-auto/);
  assert.match(sidebarSrc, /isSaved/);
});

test('ChatView implements ChatGPT-style wide workspace, right user / left borderless AI, inline media deck, and full composer', () => {
  const chatViewSrc = readWebFile('src/views/ChatView.tsx');
  assert.match(chatViewSrc, /h-dvh/);
  assert.match(chatViewSrc, /max-w-\[960px\]/);
  assert.match(chatViewSrc, /justify-end/);
  assert.match(chatViewSrc, /border-l-2 border-purple-400\/70/);
  assert.match(chatViewSrc, /Copy/);
  assert.match(chatViewSrc, /Regenerate/);
  assert.match(chatViewSrc, /Speak/);
  assert.match(chatViewSrc, /Stop/);
  assert.match(chatViewSrc, /ChatMediaDeck/);
  assert.match(chatViewSrc, /FullscreenMediaModal/);
  assert.match(chatViewSrc, /Voice Conversation|Voice/);
  assert.match(chatViewSrc, /Attach/);
  assert.match(chatViewSrc, /Image/);
  assert.match(chatViewSrc, /File/);
  assert.match(chatViewSrc, /Send/);
});

test('MarkdownMessage supports safe Markdown images, tables, fenced code blocks, and links', () => {
  const mdSrc = readWebFile('src/components/MarkdownMessage.tsx');
  assert.match(mdSrc, /!\\\[/);
  assert.match(mdSrc, /<img/);
  assert.match(mdSrc, /<table/);
  assert.match(mdSrc, /```/);
  assert.match(mdSrc, /text-\[15px\]/);
});

test('Voice command executor attaches mediaTrack and mediaQueue payloads for inline YouTube chat playback', () => {
  const execSrc = readWebFile('src/services/media/voiceCommandExecutor.ts');
  assert.match(execSrc, /mediaTrack:/);
  assert.match(execSrc, /mediaQueue:/);
});
