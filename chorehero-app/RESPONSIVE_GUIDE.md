# Responsive Sizing Guide

All screens in the app include `wp` and `hp` from `../../utils/responsive` (path varies by screen depth).

## Usage

- **wp(percent)** – width percentage (e.g. `wp('5%')` for padding, `wp('4%')` for font size)
- **hp(percent)** – height percentage (e.g. `hp('2%')` for vertical spacing)

## When to use

| Property | Use |
|----------|-----|
| paddingHorizontal, marginHorizontal, left, right | `wp()` |
| paddingVertical, marginVertical, top, bottom | `hp()` |
| fontSize | `wp()` |
| width, minWidth, maxWidth | `wp()` |
| height, minHeight, maxHeight | `hp()` |
| borderRadius (larger values) | `wp()` |
| gap (layout) | `wp()` or `hp()` |

## Approximate mappings (iPhone 11 / 414×896)

- `wp('4%')` ≈ 17px
- `wp('5%')` ≈ 21px
- `wp('6%')` ≈ 25px
- `hp('2%')` ≈ 18px
- `hp('3%')` ≈ 27px

## Screens with responsive sizing

All 55+ screens have the import. Key screens with full style updates:
- AuthScreen, AccountTypeSelectionScreen, LocationLockScreen, WaitlistScreen, OnboardingCompleteScreen
- VideoFeedScreen, CleanerProfileScreen, BookingSummaryScreen, PaymentScreen, IndividualChatScreen
- CustomerOnboardingScreen, CleanerOnboardingScreen (partial)

When adding or editing styles, prefer `wp()`/`hp()` over fixed pixel values for layout and typography.
