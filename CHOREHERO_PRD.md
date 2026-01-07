# ChoreHero - Video-First Cleaning Service Marketplace

## TL;DR
ChoreHero is a mobile marketplace connecting busy professionals with verified cleaners through video profiles, enabling trust-based 60-second bookings. It solves the trust barrier of letting strangers into homes while providing cleaners fair wages and flexible work.

## Elevator Pitch
"The Uber for cleaning services, but with video-first discovery - see exactly who's coming to clean your home before they arrive."

## Problem Statement
People need cleaning services but fear letting strangers into their homes. Current platforms use generic profiles and stock photos, creating anxiety about who will show up. Meanwhile, cleaners struggle with low platform wages and lack of direct customer relationships.

## Target Audience
**Primary**: Urban professionals (25-45) valuing time over money
**Secondary**: Verified cleaners seeking better wages and flexibility
**Tertiary**: Busy parents needing reliable household help

## USP
Video-first cleaner profiles with 30-second intros - building trust through transparency while maintaining the speed of on-demand booking.

## User Stories

### Customer Persona
- As a busy professional, I want to see who's coming to my home, so that I feel safe
- As a customer, I want to book in under 60 seconds, so that I don't waste time
- As a customer, I want real-time tracking, so that I know when to expect the cleaner

### Cleaner Persona  
- As a cleaner, I want to showcase my personality, so that customers choose me
- As a cleaner, I want to keep 70% of earnings, so that I make a living wage
- As a cleaner, I want to manage my schedule, so that I have flexibility

## Functional Requirements

### Video Discovery (Priority: High)
- [ ] 30-second cleaner intro videos
- [ ] Swipe-through video gallery
- [ ] Profile verification badges

### Booking Flow (Priority: High)
- [ ] Location confirmation with map
- [ ] Service type selection (Quick/Standard/Deep)
- [ ] Add-on toggles with instant pricing
- [ ] Time slot selection
- [ ] One-tap payment

### Trust & Safety (Priority: High)
- [ ] Background check verification display
- [ ] Real-time location sharing
- [ ] In-app messaging with templates
- [ ] Emergency contact button

### Ratings & Reviews (Priority: Medium)
- [ ] Two-way rating system
- [ ] Video testimonials option
- [ ] Service photo uploads

## User Experience

### Entry Point & First-Time Experience
* Download app from App Store/Play Store
* Splash screen with value prop: "Meet Your Cleaner Before They Arrive"
* Phone number verification
* Location permission request with trust explanation

### Core Booking Experience
* **Step 1: Location Confirmation**
  - Auto-detect location with map view
  - Draggable pin for adjustment
  - Save locations for quick selection
  - Error: Manual address entry fallback

* **Step 2: Browse Cleaner Videos**
  - Full-screen video gallery (TikTok-style)
  - Swipe up for next cleaner
  - Tap for full profile with ratings
  - Filter by availability, price, specialties

* **Step 3: Select Service**
  - Card-based service tiers
  - Visual add-on toggles
  - Real-time price calculation
  - Time estimate display

* **Step 4: Schedule & Pay**
  - Calendar with available slots
  - ASAP option highlighted
  - Saved payment methods
  - Price breakdown with tip option

* **Step 5: Confirmation**
  - Cleaner assignment notification
  - Tracking screen activation
  - Chat channel opens
  - Calendar integration prompt

### During Service Experience
* Live tracking with ETA
* Progress status updates
* Chat with canned responses
* Photo sharing capabilities

### Post-Service Experience
* Service completion notification
* Rating prompt (required)
* Tip adjustment option
* Rebook shortcut

## Success Metrics

### User-Centric Metrics
- Time to first booking < 60 seconds
- Video watch-through rate > 70%
- Customer retention rate > 40%
- Cleaner satisfaction score > 4.5/5

### Business Metrics
- GMV growth 20% MoM
- Take rate stabilized at 25-30%
- CAC < $25 per customer
- Cleaner churn < 10% monthly

### Technical Metrics
- App crash rate < 0.5%
- Video load time < 2 seconds
- Payment success rate > 98%
- API response time < 200ms

## Technical Considerations

### Technical Needs
- **Frontend**: React Native/Expo for cross-platform
- **Backend**: Supabase for real-time features
- **Video**: CDN with HLS streaming
- **Payments**: Stripe Connect for marketplace
- **Maps**: Google Maps API for location/routing

### Integration Points
- Twilio for SMS verification
- Checkr API for background checks
- Google Calendar API for scheduling
- Firebase for push notifications

### Data Storage & Privacy
- Video files in S3 with CloudFront CDN
- PII encrypted at rest
- GDPR/CCPA compliance required
- Location data retention limits

## Critical Questions or Clarifications

1. **Video moderation**: How do we ensure appropriate cleaner videos?
2. **Insurance**: Who covers damage claims - platform or cleaner?
3. **Market entry**: Single city launch or multi-city?
4. **Cleaner supply**: How to ensure enough cleaners at launch?
5. **Pricing strategy**: Dynamic pricing or fixed rates? 