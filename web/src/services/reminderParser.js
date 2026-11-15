const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function formatDueLabel(triggerAtMillis, nowMs) {
  if (!Number.isFinite(triggerAtMillis)) return 'Scheduled';
  const target = new Date(triggerAtMillis);
  const now = new Date(nowMs);
  const timeStr = target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((targetDay - todayDay) / DAY_MS);

  if (diffDays === 0) return `Today ${timeStr}`;
  if (diffDays === 1) return `Tomorrow ${timeStr}`;
  return `${target.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function parseClockTime(text) {
  const match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (!/\b(at|:)\b/i.test(match[0])) {
    // Require explicit "at" or ":" or am/pm so numbers inside task titles aren't misread as hours
    return null;
  }

  return { hour, minute, matchedText: match[0] };
}

function cleanReminderTitle(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^(?:please\s+)?(?:jarvis\s+)?remind\s+me\s+(?:to\s+)?/i, '');
  s = s.replace(/^(?:set\s+(?:a\s+)?reminder\s+(?:to|for)\s+)/i, '');
  s = s.replace(/^(?:schedule|add\s+task|todo)\s*[:\-]?\s*/i, '');
  s = s.replace(/\b(?:in\s+\d+\s+(?:minutes?|mins?|hours?|hrs?))\b/gi, ' ');
  s = s.replace(/\b(?:today|tomorrow|tonight)\b/gi, ' ');
  s = s.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ');
  s = s.replace(/\bat\s+\d{1,2}(?::\d{2})?\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').replace(/^[,.\-:\s]+|[,.\-:\s]+$/g, '').trim();
  if (!s) return 'Scheduled Reminder';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function parseReminderFallback(input, nowMs = Date.now()) {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      title: 'Scheduled Reminder',
      description: 'Created from natural language reminder parser',
      dueTime: 'In 1 hour',
      triggerAtMillis: nowMs + 60 * MINUTE_MS,
      priority: 'MEDIUM',
      category: 'REMINDER',
    };
  }

  const lower = raw.toLowerCase();
  let triggerAtMillis = null;

  // 1. Relative offset: "in 15 minutes", "in 2 hours"
  const relMatch = lower.match(/\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/);
  if (relMatch) {
    const qty = Math.max(1, Number(relMatch[1]));
    const unit = relMatch[2];
    const mult = unit.startsWith('h') ? 60 * MINUTE_MS : MINUTE_MS;
    triggerAtMillis = nowMs + qty * mult;
  } else {
    // 2. Day + explicit clock time ("tomorrow at 5 pm", "tonight at 8", "at 17:30")
    const hasTomorrow = /\btomorrow\b/i.test(lower);
    const hasTonight = /\btonight\b/i.test(lower);
    const clock = parseClockTime(lower);

    if (clock || hasTomorrow || hasTonight) {
      const target = new Date(nowMs);
      if (hasTomorrow) {
        target.setDate(target.getDate() + 1);
      }
      if (clock) {
        target.setHours(clock.hour, clock.minute, 0, 0);
      } else if (hasTonight) {
        target.setHours(20, 0, 0, 0);
      } else {
        target.setHours(9, 0, 0, 0);
      }
      if (!hasTomorrow && target.getTime() <= nowMs) {
        target.setDate(target.getDate() + 1);
      }
      triggerAtMillis = target.getTime();
    } else {
      // Default to 1 hour from now if no explicit time was provided
      triggerAtMillis = nowMs + 60 * MINUTE_MS;
    }
  }

  const priority = /\b(urgent|asap|critical|important|immediately|high priority)\b/i.test(lower)
    ? 'HIGH'
    : /\b(low priority|whenever|sometime|eventually)\b/i.test(lower)
      ? 'LOW'
      : 'MEDIUM';

  const category = /\b(meeting|call|briefing|schedule|appointment|zoom)\b/i.test(lower)
    ? 'SCHEDULE'
    : 'REMINDER';

  const title = cleanReminderTitle(raw);

  return {
    title,
    description: raw,
    dueTime: formatDueLabel(triggerAtMillis, nowMs),
    triggerAtMillis,
    priority,
    category,
  };
}

export function sanitizeParsedReminder(rawObj, fallbackInput, nowMs = Date.now()) {
  const fallback = parseReminderFallback(fallbackInput, nowMs);
  if (!rawObj || typeof rawObj !== 'object') {
    return fallback;
  }

  const title =
    typeof rawObj.title === 'string' && rawObj.title.trim().length > 0
      ? rawObj.title.trim().slice(0, 120)
      : fallback.title;

  const description =
    typeof rawObj.description === 'string' && rawObj.description.trim().length > 0
      ? rawObj.description.trim().slice(0, 280)
      : fallback.description;

  const allowedPriorities = new Set(['HIGH', 'MEDIUM', 'LOW']);
  const priorityCandidate = String(rawObj.priority || '').trim().toUpperCase();
  const priority = allowedPriorities.has(priorityCandidate) ? priorityCandidate : fallback.priority;

  const allowedCategories = new Set(['REMINDER', 'TASK', 'SCHEDULE', 'NOTE']);
  const categoryCandidate = String(rawObj.category || '').trim().toUpperCase();
  const category = allowedCategories.has(categoryCandidate) ? categoryCandidate : fallback.category;

  let triggerAtMillis = fallback.triggerAtMillis;
  if (typeof rawObj.delayMinutes === 'number' && Number.isFinite(rawObj.delayMinutes) && rawObj.delayMinutes > 0) {
    triggerAtMillis = nowMs + Math.round(rawObj.delayMinutes * MINUTE_MS);
  } else if (typeof rawObj.dueIso === 'string' && rawObj.dueIso.trim()) {
    const parsedEpoch = Date.parse(rawObj.dueIso.trim());
    if (Number.isFinite(parsedEpoch) && parsedEpoch > nowMs - 5 * MINUTE_MS) {
      triggerAtMillis = parsedEpoch;
    }
  } else if (typeof rawObj.triggerAtMillis === 'number' && Number.isFinite(rawObj.triggerAtMillis)) {
    triggerAtMillis = rawObj.triggerAtMillis;
  }

  const dueTime =
    typeof rawObj.dueTime === 'string' && rawObj.dueTime.trim().length > 0
      ? rawObj.dueTime.trim().slice(0, 64)
      : formatDueLabel(triggerAtMillis, nowMs);

  return {
    title,
    description,
    dueTime,
    triggerAtMillis,
    priority,
    category,
  };
}
