# CHORE_HERO_MASTER_CONTEXT.md
# Location: /docs/CHORE_HERO_MASTER_CONTEXT.md
# Purpose: Living knowledge bank for AI advisor consistency

## PROJECT IDENTITY
- **Name:** Chore Hero
- **Concept:** TikTok-style marketplace for service professionals
- **Tagline:** "TikTok meets DoorDash for home services"
- **Two-sided:** Customer app ("Chore") + Pro app ("Hero")
- **Core Differentiator:** Video quotes + video-first discovery

## USER CONTEXT (Why This Exists)
- Builder needs fast revenue for family support and off-grid independence
- Timeline: Urgent but sustainable
- Approach: Validate manually → automate → scale
- Design target: BiteSight-inspired UI/UX

## ARCHITECTURE DECISIONS LOG

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|-------------|
| Feb 26 | Guest mode first | Reduce friction, increase retention | Yes |
| Feb 26 | Phone auth primary | Mobile-native, faster than email | Yes |
| Feb 26 | Demo content fallback | Never empty states | No |
| Feb 26 | Location: GPS→IP→Default | Privacy-first graceful degradation | Yes |

## COMPLETED ROUNDS

### ROUND 1: Guest Mode + Welcome Flow ✅
**Status:** COMPLETE | **Date:** Feb 26, 2026

| Feature | Implementation | Files | Notes |
|---------|---------------|-------|-------|
| Phone-first auth | UI ready, Twilio pending | WelcomeScreen.tsx | Fallback to email link |
| Guest browse mode | Full implementation | AuthContext.tsx | Soft prompts at 3/5 views |
| Dynamic location | GPS→IP→NYC fallback | useLocationDetection.ts | ipapi.co for IP geo |
| Demo video population | Never empty states | useFeedPopulation.ts | "Sample" badge on all |
| "Book Now" CTA | Triggers signup modal | VideoFeedScreen.tsx | Guest check before demo |
| Guest prompts | 3 views: save, 5 views: book | GuestPromptModal.tsx | 24h cooldown if dismissed |
| ProfileTypeScreen | Post-auth only | ProfileTypeScreen.tsx | Replaced old screen |
| Deleted old screen | Fully removed | - | AccountTypeSelectionScreen gone |

**Analytics Events:**
- location_detected {method, city}
- feed_populated {source, city, count}
- guest_prompt_shown {trigger, type}
- guest_prompt_dismissed/converted
- guest_booking_attempt

## IN PROGRESS / NEXT

### ROUND 2: Pro Dashboard + Video Quote System 🔄
**Priority:** CRITICAL | **Status:** NOT STARTED

| Feature | Spec Status | Blockers |
|---------|-------------|----------|
| Pro earnings screen | Need screenshots | None |
| Pro leads/listings screen | Need screenshots | None |
| Pro schedule/calendar screen | Need screenshots | None |
| Video quote recording flow | Designed, needs build | None |
| Job matching algorithm | Pseudocode ready | None |
| Pro onboarding paths (A/B/C) | Designed | None |

### ROUND 3: Polish + Scale ⏳
- Payment integration (Stripe)
- Background checks (Checkr)
- Insurance verification
- Push notifications (OneSignal)

## CURRENT BUGS / DEBT

| Issue | Severity | Status | Fix Date |
|-------|----------|--------|----------|
| Twilio phone verify not hooked up | Medium | Backend pending | Week 2 |
| Guest view count may double-count | Low | Verify unique IDs | Ongoing |
| Pro side UI not started | High | Round 2 | Now |

### Recently Fixed
| Issue | Fix |
|-------|-----|
| Loading/feed glitch (flicker between black screen and feed) | Memoized `userLocation` in `useLocationDetection.ts` so effect deps stay stable |

## FILE INVENTORY

### Created (Round 1)
- `chorehero-app/src/hooks/useLocationDetection.ts`
- `chorehero-app/src/screens/onboarding/ProfileTypeScreen.tsx`
- `chorehero-app/src/components/GuestPromptModal.tsx`

### Modified (Round 1)
- `chorehero-app/src/screens/shared/VideoFeedScreen.tsx`
- `chorehero-app/src/screens/shared/WelcomeScreen.tsx`
- `chorehero-app/src/hooks/useFeedPopulation.ts`
- `chorehero-app/src/navigation/AuthNavigator.tsx`

### Deleted (Round 1)
- `chorehero-app/src/screens/onboarding/AccountTypeSelectionScreen.tsx`

## REFERENCE MATERIALS

- **BiteSight Screenshots:** `/assets/reference/bitesight/`
- **Chore Hero Screenshots:** `/assets/reference/chorehero/`
- **Original Prompts:** `/docs/prompts/`

## HOW TO USE THIS DOC

1. **Before each Cursor session:** Copy relevant "In Progress" section
2. **After each session:** Update "Completed" and "Bugs" sections
3. **When starting new chat with me:** Paste this doc + latest screenshots
4. **Version:** Update date in header after each major change
5. **Keep it lean:** This is a high-level context doc. Link to detailed specs elsewhere; avoid turning it into a full spec.

## LAST UPDATED
2026-02-26 — Round 1 complete, Round 2 pending
