# 🚀 ChoreHero Live Testing Setup Guide

## 📋 **Prerequisites Checklist**

Before starting live testing, ensure you have:

- ✅ **Supabase Project** - Database for all app data
- ✅ **Stripe Account** - Payment processing
- ✅ **Google Maps API** - Location services
- ✅ **Expo Development Environment** - React Native testing

---

## 🗄️ **Step 1: Database Deployment**

### **Deploy Database Schema**

1. **Open Supabase Dashboard** → [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Select your ChoreHero project**
3. **Go to SQL Editor** (left sidebar)
4. **Create new query**
5. **Copy entire contents** of `supabase/LIVE_READINESS_SETUP.sql`
6. **Click "Run"** to execute

**Expected Result:**
```sql
🎉 CHOREHERO DATABASE SETUP COMPLETE!
Ready for live customer ↔ cleaner usage
```

**Tables Created:**
- `users` - Customer and cleaner accounts
- `user_profiles` - Extended profile data
- `content_posts` - Video/image content
- `bookings` - Service bookings
- `payments` - Payment records
- `chat_rooms` & `chat_messages` - Real-time messaging
- `location_updates` - GPS tracking data
- `reviews` - Service reviews
- `service_categories` - Available services

---

## 🔑 **Step 2: Environment Configuration**

### **Create .env File**

Create `.env` file in the `chorehero-app/` directory:

```bash
# SUPABASE CONFIGURATION
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# STRIPE CONFIGURATION  
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# GOOGLE MAPS CONFIGURATION
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# DEVELOPMENT SETTINGS
EXPO_PUBLIC_DEV_MODE=true
EXPO_PUBLIC_ENVIRONMENT=development
```

### **Get Supabase Credentials**

1. **Go to Supabase Dashboard** → Your Project
2. **Click "Settings"** → **"API"**
3. **Copy Project URL** and **anon/public key**
4. **Add to .env file**

### **Get Stripe Credentials**

1. **Go to Stripe Dashboard** → [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Click "Developers"** → **"API Keys"**
3. **Copy Publishable Key** (starts with `pk_test_`)
4. **Add to .env file**

### **Get Google Maps API Key**

1. **Go to Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com)
2. **Enable "Maps SDK for Android"** and **"Maps SDK for iOS"**
3. **Create API Key** in Credentials
4. **Add to .env file**

---

## 🧪 **Step 3: Test Customer Workflow**

### **Start the App**

```bash
cd chorehero-app
npm start
```

### **Customer Journey Test**

1. **Create Customer Account**
   - Open app on device/simulator
   - Tap "Sign Up"
   - Choose "Customer" role
   - Complete profile setup

2. **Browse Content Feed**
   - View cleaning videos
   - Like and comment on posts
   - Search for specific content

3. **Find and View Cleaner**
   - Browse "Discover" tab
   - Tap on service category
   - View cleaner profiles

4. **Book a Service**
   - Select cleaner and service
   - Choose date/time
   - Add address
   - Complete booking flow

5. **Payment Testing**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Complete payment

6. **Track Service**
   - View booking status
   - See cleaner location (simulated)
   - Communicate via chat

---

## 🧹 **Step 4: Test Cleaner Workflow**

### **Cleaner Journey Test**

1. **Create Cleaner Account**
   - Open app in new session/device
   - Tap "Sign Up"
   - Choose "Cleaner" role
   - Complete professional profile

2. **Upload Content**
   - Record or select cleaning video
   - Add title, description, pricing
   - Publish to feed

3. **Set Availability**
   - Configure service hours
   - Set service areas
   - Enable booking acceptance

4. **Accept Booking**
   - Receive booking notification
   - Review booking details
   - Accept booking

5. **Provide Service**
   - Navigate to customer location
   - Start GPS tracking
   - Communicate with customer
   - Complete service

6. **Receive Payment**
   - Confirm service completion
   - Receive payment notification
   - View earnings dashboard

---

## 🤝 **Step 5: Test Live Interactions**

### **Customer ↔ Cleaner Synchronization**

1. **Real-time Messaging**
   - Send messages between accounts
   - Verify delivery and read receipts
   - Test image sharing

2. **Live GPS Tracking**
   - Start tracking from cleaner app
   - Verify location updates in customer app
   - Test ETA calculations

3. **Booking State Sync**
   - Update booking status from cleaner
   - Verify updates appear in customer app
   - Test cancellation flows

4. **Payment & Review Flow**
   - Complete payment from customer
   - Verify payment receipt by cleaner
   - Submit and receive reviews

---

## 🛡️ **Step 6: Verify Automated Testing**

### **Run Quick Health Check**

```bash
npm run test:quick-check
```

**Expected Output:**
```
⚡ ChoreHero Quick Health Check Results:
Health: EXCELLENT  
Score: 97/100
✅ All 28 gaps remain fixed
🎯 System Status: BULLETPROOF
```

### **Run Gap Regression Tests**

```bash
npm run test:gap-regression
```

**Expected Result:**
```
🔍 Gap Regression Test Results:
✅ 28/28 gaps remain fixed
🎉 All systems bulletproof!
```

---

## 🎯 **Live Testing Scenarios**

### **Scenario 1: Happy Path Booking**
1. Customer signs up → Browses → Books → Pays
2. Cleaner receives → Accepts → Provides service → Gets paid
3. Both parties review each other
4. **Verify:** All data flows correctly, payments process, reviews display

### **Scenario 2: Cancellation Flow**
1. Customer books service
2. Cleaner accepts
3. Customer cancels before service
4. **Verify:** Refund processes, both parties notified, calendar updated

### **Scenario 3: Communication Stress Test**
1. Send 20+ rapid messages between accounts
2. Share images and location updates
3. **Verify:** All messages deliver, no duplicates, performance stays good

### **Scenario 4: Multiple Concurrent Bookings**
1. Create 3+ customer accounts
2. Try to book same cleaner at same time slot
3. **Verify:** Only one booking succeeds, others get error message

---

## 🚨 **Common Issues & Solutions**

### **Database Connection Issues**
- **Problem:** App can't connect to Supabase
- **Solution:** Verify `.env` file has correct URL and keys
- **Check:** Supabase project is not paused

### **Payment Processing Issues**
- **Problem:** Stripe payments fail
- **Solution:** Use test card numbers from Stripe docs
- **Check:** Stripe publishable key is correct

### **GPS Tracking Issues**
- **Problem:** Location updates don't work
- **Solution:** Enable location permissions on device
- **Check:** Google Maps API key is configured

### **Authentication Issues**
- **Problem:** Can't sign up/sign in
- **Solution:** Check Supabase Auth settings
- **Check:** Email confirmations are disabled for testing

---

## ✅ **Success Criteria**

### **Live Testing is Complete When:**

- ✅ **Customer can complete full journey** (signup → book → pay → review)
- ✅ **Cleaner can complete full journey** (signup → accept → serve → get paid)
- ✅ **Real-time features work** (messaging, GPS tracking, notifications)
- ✅ **Payment processing works** (Stripe test transactions succeed)
- ✅ **Automated testing passes** (all 28 gaps remain fixed)
- ✅ **Performance is acceptable** (< 3s app startup, < 500ms API calls)

---

## 🚀 **Next: Production Deployment**

Once live testing passes all criteria:

1. **Switch to Stripe Live Keys** (for real payments)
2. **Set up production Supabase** (with proper backups)
3. **Configure production domains** (for API restrictions)
4. **Set up monitoring alerts** (for system health)
5. **Deploy to app stores** (iOS App Store, Google Play)

**ChoreHero will be bulletproof and ready for real customers!** 🎉
