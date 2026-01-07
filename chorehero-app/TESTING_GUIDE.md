# 🧪 ChoreHero Beta Testing Guide

Welcome to ChoreHero beta testing! This guide will help you test every feature and provide valuable feedback.

## 📱 Getting Started

### Access the App
1. Download "Expo Go" from App Store/Play Store
2. Scan this QR code or visit: https://expo.dev/accounts/goatmalik/projects/chorehero-app
3. Choose your testing method:
   - **Real Account**: Create account with email/password (recommended)
   - **Demo Mode**: Quick access as guest (Customer or Cleaner)

## 🎯 Complete Testing Checklist

### 🔐 Authentication Flow
- [ ] **Sign Up**: Create new account with email/password
- [ ] **Account Type Selection**: Choose Customer or Cleaner
- [ ] **Onboarding**: Complete profile setup
- [ ] **Sign In**: Log back in with credentials
- [ ] **Password Validation**: Try weak passwords
- [ ] **Demo Access**: Test guest mode (both roles)
- [ ] **Remember Me**: Test login persistence

### 👤 Customer Side Testing

#### **Dashboard & Discovery**
- [ ] **Dashboard loads** with proper greeting
- [ ] **Service categories** display and are tappable
- [ ] **"Book Now" button** works
- [ ] **Search functionality** works
- [ ] **Browse cleaners** shows profiles
- [ ] **Filters** work (price, rating, distance)
- [ ] **Pull to refresh** updates content

#### **Booking Flow**
- [ ] **Service selection** works
- [ ] **Cleaner selection** shows profiles and ratings
- [ ] **Date/Time picker** functions properly
- [ ] **Address entry** accepts input
- [ ] **Special requests** text area works
- [ ] **Price calculation** updates correctly
- [ ] **Payment screen** displays (don't enter real card info)
- [ ] **Booking confirmation** shows all details
- [ ] **"View Booking" button** navigates correctly

#### **Booking Management**
- [ ] **Active bookings** display current jobs
- [ ] **Booking history** shows past services
- [ ] **Booking details** show complete information
- [ ] **One-tap rebooking** works from history
- [ ] **Quick rebook** suggestions appear
- [ ] **Cancel booking** (test with demo bookings)

#### **Messaging & Communication**
- [ ] **Messages tab** shows conversations
- [ ] **Individual chat** opens properly
- [ ] **Send messages** works
- [ ] **Quick reply templates** work
- [ ] **Photo sharing** (camera/gallery)
- [ ] **Message timestamps** display correctly

#### **Profile & Settings**
- [ ] **Profile screen** shows user info
- [ ] **Edit profile** allows changes
- [ ] **Payment methods** screen loads
- [ ] **Booking history** accessible
- [ ] **Notifications settings** toggles work
- [ ] **Help & Support** links work
- [ ] **Privacy & Terms** pages load
- [ ] **Sign out** returns to login screen

### 🧹 Cleaner Side Testing

#### **Dashboard**
- [ ] **Dashboard loads** with cleaner interface
- [ ] **Online/Offline toggle** works
- [ ] **Profile completion bar** shows progress
- [ ] **Today's performance** displays stats
- [ ] **Goals tracker** shows earnings progress
- [ ] **Edit goals** functionality works
- [ ] **Demo toggle** switches between states
- [ ] **Notification badge** shows alerts

#### **Job Management**
- [ ] **Available jobs** list displays
- [ ] **Job details** show complete info
- [ ] **Accept job** works with confirmation
- [ ] **Reject job** removes from list
- [ ] **Active jobs** show current work
- [ ] **Job status updates** work
- [ ] **Job history** displays completed work
- [ ] **Loading states** display properly

#### **Content & Analytics**
- [ ] **Video upload** screen loads
- [ ] **Camera recording** works
- [ ] **Video gallery selection** works
- [ ] **Upload progress** displays
- [ ] **Cancel upload** works
- [ ] **Video analytics** show views/bookings
- [ ] **Content management** allows editing

#### **Profile Management**
- [ ] **Profile editing** screen works
- [ ] **Photo upload** (camera/gallery)
- [ ] **Bio editing** saves changes
- [ ] **Service areas** can be updated
- [ ] **Hourly rates** can be modified
- [ ] **Availability settings** work
- [ ] **Verification status** displays

#### **Navigation & Floating Tabs**
- [ ] **Bottom navigation** shows all tabs
- [ ] **Tab switching** works smoothly
- [ ] **Active tab** highlights correctly
- [ ] **Badge notifications** appear on tabs
- [ ] **Floating style** displays properly

### 🚨 Error Handling & Edge Cases

#### **Network & Connectivity**
- [ ] **Poor connection**: Test with bad WiFi
- [ ] **Offline mode**: Turn off internet
- [ ] **Connection recovery**: Return online
- [ ] **Failed requests**: Force network errors
- [ ] **Retry mechanisms**: Check retry buttons

#### **Form Validation**
- [ ] **Empty fields**: Submit forms without required data
- [ ] **Invalid email**: Use malformed email addresses
- [ ] **Short passwords**: Test minimum length
- [ ] **Special characters**: Test various inputs
- [ ] **Real-time validation**: Check instant feedback

#### **Upload & Media**
- [ ] **Large files**: Try uploading big videos
- [ ] **Unsupported formats**: Upload wrong file types
- [ ] **Upload interruption**: Cancel mid-upload
- [ ] **Multiple uploads**: Try simultaneous uploads
- [ ] **Permission denied**: Deny camera/gallery access

#### **Performance Testing**
- [ ] **Large lists**: Scroll through many items
- [ ] **Quick scrolling**: Test smooth performance
- [ ] **Memory usage**: Use app extensively
- [ ] **Background/foreground**: Switch between apps
- [ ] **Long usage**: Use for extended periods

### 📊 Specific Features to Test

#### **Robustness Features**
- [ ] **Job competition**: Multiple testers accept same job
- [ ] **Network resilience**: Test offline/online transitions
- [ ] **Form validation**: Test all validation rules
- [ ] **Upload recovery**: Interrupt and resume uploads
- [ ] **Performance**: Smooth operation with large data

#### **User Experience**
- [ ] **Animations**: Check smooth transitions
- [ ] **Loading states**: Verify all loading indicators
- [ ] **Error messages**: Clear, helpful feedback
- [ ] **Accessibility**: Test with screen reader
- [ ] **Color contrast**: Check readability

## 🐛 Bug Reporting

When you find issues, please report:

### Required Information
- **Device**: iPhone/Android model & OS version
- **Steps to reproduce**: Exact sequence that caused the issue
- **Expected behavior**: What should have happened
- **Actual behavior**: What actually happened
- **Screenshots/Videos**: Visual evidence if possible

### Report Format
```
**Bug Title**: Brief description
**Device**: iPhone 14 Pro, iOS 17.1
**Steps**:
1. Open app
2. Navigate to X screen
3. Tap Y button
4. Error occurs

**Expected**: Should navigate to Z screen
**Actual**: App crashes / Shows error message
**Screenshot**: [Attach if available]
```

## 💡 Feedback Categories

### What to Focus On
1. **Usability**: Is it intuitive and easy to use?
2. **Performance**: Does it feel fast and responsive?
3. **Reliability**: Do features work consistently?
4. **Design**: Does it look professional and polished?
5. **Features**: Are any features missing or confusing?

### Questions to Consider
- Would you use this app for real cleaning services?
- How does it compare to other marketplace apps?
- What would make you recommend it to others?
- What frustrates you most about the experience?
- What do you love most about the app?

## 🚀 Advanced Testing

### Multi-User Scenarios
- **Coordination**: Have multiple testers interact
- **Job competition**: Multiple cleaners accept same job
- **Real-time updates**: Test live messaging
- **Concurrent usage**: Multiple users simultaneously

### Edge Cases
- **Account switching**: Switch between Customer/Cleaner
- **Role transitions**: Test account type changes
- **Data persistence**: Log out and back in
- **Cross-platform**: Test iOS and Android differences

## 📝 Feedback Submission

### How to Submit
1. **In-app**: Use Help & Support section
2. **Email**: Send detailed reports
3. **Screenshots**: Include visual evidence
4. **Video**: Record issues in action

### What Helps Most
- **Specific examples** rather than general feedback
- **Reproducible steps** to recreate issues
- **Suggestions** for improvements
- **Comparison** to other apps you like

## 🎉 Thank You!

Your testing helps make ChoreHero better for everyone. Every bug found and improvement suggested makes the app more reliable and user-friendly.

**Happy Testing!** 🧪✨

---

*Questions? Contact the development team through the app's Help section.*