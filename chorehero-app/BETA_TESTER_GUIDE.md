# ChoreHero Beta Tester Guide

## 🎯 Real Account Creation Now Available!

Beta testers can now create **real accounts** that save their information and preferences. Your data will persist between app sessions and populate your profile with actual information.

## 🚀 How to Create a Real Account

### Step 1: Launch the App
- Open ChoreHero
- You'll see the welcome screen with sign-in options

### Step 2: Create Account
- Tap **"Sign Up"** (not "Demo Access")
- Enter your **real email address** and create a **secure password**
- Tap **"Create Account"**

### Step 3: Choose Your Role
- Select **"I need cleaning services"** (Customer)
- OR select **"I want to provide cleaning services"** (Cleaner)

### Step 4: Complete Onboarding
- **Customers**: Fill out your address, preferences, and home details
- **Cleaners**: Complete all verification steps including background check consent
- **All information is saved to the database**

### Step 5: Enjoy Your Personalized Experience
- Your profile will show your real name and email
- Customer bookings and preferences are saved
- Cleaner profiles and availability are stored

## 📱 What's Different with Real Accounts?

### ✅ **Real Account Features**
- **Persistent Data**: Your information is saved between sessions
- **Real Profile**: Shows your actual name, email, and onboarding data
- **Database Storage**: All preferences and settings are stored securely
- **Full Authentication**: Proper sign-in/sign-out functionality
- **Future Booking History**: When booking system is active, your history will be saved

### 🎭 **Demo Mode Features** (Fallback)
- **Temporary Session**: Data is not saved between sessions
- **Mock Information**: Shows sample data and profiles
- **Limited Functionality**: Some features may be restricted
- **No Registration Required**: Quick exploration without commitment

## 🔐 Authentication Flow

### Sign Up Process:
1. **Email/Password** → Supabase Auth creates user
2. **Account Type Selection** → Choose Customer or Cleaner
3. **Onboarding** → Complete profile information
4. **Database Storage** → All data saved to user tables
5. **Main App** → Access full functionality

### Sign In Process:
1. **Email/Password** → Authenticate with Supabase
2. **Profile Loading** → Retrieve saved user data
3. **Main App** → Resume with your saved preferences

## 📊 Profile Data Integration

### Customer Profiles Include:
- Personal information (name, phone, email)
- Home address and details
- Cleaning preferences and frequency
- Special instructions and pet details
- Future: Booking history and favorite cleaners

### Cleaner Profiles Include:
- Personal and business information
- Service areas and availability
- Skills and experience levels
- Rates and service offerings
- Background check status
- Future: Job history and ratings

## 🎮 Demo Mode (Still Available)

If you want to quickly explore without creating an account:

1. Tap **"Demo Access"** on the welcome screen
2. Choose **"Demo as Customer"** or **"Demo as Cleaner"**
3. Explore the app with sample data
4. Create a real account anytime for full features

## 🔄 Switching Between Accounts

- **Sign Out**: Tap Profile → Account Management → Sign Out
- **Switch Roles**: Sign out and create a new account with different role
- **Demo to Real**: Sign out of demo mode and create a real account

## 🛠 Technical Details

### Database Tables:
- `users` - Basic user information and role
- `customer_profiles` - Customer-specific data
- `cleaner_profiles` - Cleaner-specific data and verification

### Authentication:
- **Supabase Auth** - Secure email/password authentication
- **Row Level Security** - Data isolation between users
- **Session Management** - Automatic login state persistence

## 🐛 Reporting Issues

When testing, please report:

1. **Authentication Issues**
   - Sign up/sign in failures
   - Profile data not saving
   - Session management problems

2. **Data Persistence**
   - Information not appearing after restart
   - Profile fields not populating
   - Onboarding data loss

3. **UI/UX Issues**
   - Confusing flows
   - Missing information
   - Performance problems

## 📝 What to Test

### High Priority:
- [ ] Create customer account with real email
- [ ] Complete customer onboarding
- [ ] Verify profile shows real data
- [ ] Sign out and sign back in
- [ ] Create cleaner account
- [ ] Complete cleaner onboarding
- [ ] Test demo mode still works

### Medium Priority:
- [ ] Switch between accounts
- [ ] Profile data accuracy
- [ ] Navigation and UI
- [ ] Combined dashboard/profile experience

## 🚀 Future Enhancements

When real bookings are implemented:
- Customer booking history will populate
- Cleaner job history will be tracked
- Payment and rating systems will be connected
- Real-time status updates

---

**Thank you for beta testing ChoreHero!** 🌟

Your feedback helps us create the best cleaning service marketplace experience. 