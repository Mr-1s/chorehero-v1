# ChoreHero Booking System Test Guide

## 🎯 Overview
This guide explains how to test the newly implemented end-to-end booking system that connects demo customers with demo cleaners through real database operations.

## 🔧 What's Been Implemented

### ✅ **Demo-to-Production Bridge**
- **demoBookingService**: Converts demo UI interactions into real database records
- **Enhanced BookingService**: Auto-creates chat rooms when jobs are accepted
- **SimpleBookingFlowScreen**: Now creates real bookings for demo users
- **Fixed MessageService**: Proper chat room creation and messaging

### ✅ **Key Features**
1. **Real Database Operations**: Demo bookings create actual database records
2. **Automatic Notifications**: Cleaners get notified when bookings are created
3. **Chat Room Creation**: Automatic chat rooms with welcome messages
4. **End-to-End Flow**: Customer books → Cleaner sees job → Accepts → Chat works

## 🧪 Testing Steps

### **Step 1: Demo Customer Books Service**
1. **Login as Demo Customer**: Use demo customer account
2. **Browse Heroes Feed**: View cleaner videos/content
3. **Book Service**: Tap "Book Service" on any cleaner's content
4. **Complete Booking Flow**: Fill out the booking form
5. **Submit Booking**: Creates real database record

**Expected Result**: 
- ✅ Real booking record created in `bookings` table
- ✅ Notifications sent to demo cleaners
- ✅ Booking shows up in cleaner job feeds

### **Step 2: Demo Cleaner Receives Notification**
1. **Login as Demo Cleaner**: Switch to cleaner account
2. **Check Jobs Tab**: Navigate to Jobs/Dashboard
3. **View Available Jobs**: See the booking from Step 1
4. **Accept Job**: Tap "Accept" on the booking

**Expected Result**:
- ✅ Job status changes to "confirmed"
- ✅ Chat room automatically created
- ✅ Welcome message sent to chat
- ✅ Customer gets notification

### **Step 3: Test Messaging System**
1. **Open Chat**: Both customer and cleaner can access chat
2. **Send Messages**: Test real-time messaging
3. **Verify Persistence**: Messages saved to database
4. **Check Notifications**: Message notifications work

**Expected Result**:
- ✅ Real-time messaging works
- ✅ Messages persist in database
- ✅ Chat linked to booking
- ✅ Both parties can communicate

## 📊 Database Tables Used

### **bookings**
- Stores all booking records
- Links customer to cleaner
- Tracks status changes

### **chat_rooms**
- Auto-created when job accepted
- Links to booking_id
- Stores participants array

### **chat_messages**
- Real-time messages
- Links to room_id
- Message types: text, booking_update

### **notifications**
- Booking notifications
- Message notifications
- Like/comment notifications

## 🔍 Debugging Tips

### **Check Database Records**
```sql
-- View recent bookings
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5;

-- View chat rooms
SELECT * FROM chat_rooms ORDER BY created_at DESC LIMIT 5;

-- View notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
```

### **Console Logging**
Look for these log messages:
- `🎭 Demo user creating real booking`
- `✅ Real booking created for demo user`
- `🏠 Creating chat room for booking`
- `✅ Chat room created successfully`

### **Common Issues**
1. **Chat Tables Missing**: Run `supabase/messaging_schema.sql`
2. **Seed Data Missing**: Run `supabase/seed-data.sql`
3. **RLS Policies**: Ensure Row Level Security is properly configured

## 🚀 Next Steps

### **Ready for Implementation**
1. **Real User Bookings**: Extend to work with actual authenticated users
2. **Payment Integration**: Add Stripe payment processing
3. **Push Notifications**: Mobile push notifications for booking events
4. **Live Tracking**: GPS tracking during cleaning

### **MVP Features Complete**
- ✅ Customer can book cleaners
- ✅ Cleaners receive job notifications
- ✅ Real-time messaging works
- ✅ Database operations functional
- ✅ Demo system demonstrates full workflow

## 🎯 Success Criteria

The booking system is working correctly when:

1. **Demo Customer**: Can book services from Heroes feed
2. **Real Database**: Booking records are created and persisted
3. **Demo Cleaner**: Sees real job opportunities and can accept them
4. **Chat System**: Automatic chat rooms with working messaging
5. **Notifications**: Both parties receive appropriate notifications
6. **End-to-End**: Complete workflow from discovery to communication

This provides a **fully functional marketplace backend** that will seamlessly transition from demo data to real user data as the platform grows! 🎉