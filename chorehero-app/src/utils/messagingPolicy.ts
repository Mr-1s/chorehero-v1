/**
 * Client-side checks to discourage moving payments / PII off-platform.
 * Not a full moderation layer — server rules should enforce repeat offenders.
 */

export type MessagePolicyResult = { ok: true } | { ok: false; message: string };

const OFF_PLATFORM_REASON =
  'To keep everyone protected, stay on ChoreHero for scheduling and payments. Don’t share phone numbers, social handles, or links to chat apps.';

function testPatterns(text: string, patterns: RegExp[]): boolean {
  for (const p of patterns) {
    if (p.test(text)) return true;
  }
  return false;
}

/**
 * Returns invalid if the message clearly tries to move the conversation or payment off-app.
 */
export function validateOutgoingChatMessage(text: string): MessagePolicyResult {
  const raw = text.trim();
  if (!raw) return { ok: true };

  const lower = raw.toLowerCase();

  const urlOrApp =
    /(https?:\/\/|wa\.me|t\.me\/|telegram\.me|discord\.(gg|me|com\/invite)|snapchat\.com|instagram\.com|tiktok\.com|venmo\.com|cash\.app|paypal\.me)/i;
  if (urlOrApp.test(raw)) {
    return { ok: false, message: OFF_PLATFORM_REASON };
  }

  if (
    testPatterns(lower, [
      /\bwhatsapp\b/,
      /\btelegram\b/,
      /\bdiscord\b/,
      /\bsnapchat\b/,
      /\binstagram\s*dm\b/,
      /\bface\s*time\b/,
      /\bfacetime\b/,
      /\bgoogle\s*chat\b/,
      /\bsignal\b.*\b(app|number)\b/,
    ])
  ) {
    return { ok: false, message: OFF_PLATFORM_REASON };
  }

  if (
    testPatterns(lower, [
      /\b(text|call|dm|message|reach)\s+me\s+(on|at|outside|off)\b/,
      /\b(continue|move|take)\s+(this\s+)?(chat|conversation)\s+(elsewhere|off|outside)\b/,
      /\b(outside|off)\s+the\s+app\b/,
      /\bmy\s+(number|cell|phone)\s+is\b/,
      /\b(here'?s|here is)\s+my\s+\d/,
    ])
  ) {
    return { ok: false, message: OFF_PLATFORM_REASON };
  }

  // US / international phone patterns (avoids short numbers)
  if (/\b(\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/.test(raw)) {
    return { ok: false, message: OFF_PLATFORM_REASON };
  }
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(raw)) {
    return { ok: false, message: OFF_PLATFORM_REASON };
  }

  return { ok: true };
}
