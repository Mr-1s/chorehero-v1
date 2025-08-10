# 🧪 Quick Booking Test Guide

## 🚀 How to Test the Booking Feature

### **Step 1: Ensure Database is Ready**
First, make sure your Supabase database has the required tables and seed data:

1. **Check Supabase Dashboard**: Go to your Supabase project
2. **Run Messaging Schema** (if not already done):
   ```sql
   -- Copy and paste from: chorehero-app/supabase/messaging_schema.sql
   -- This creates chat_rooms and chat_messages tables
   ```

3. **Run Seed Data** (if not already done):
   ```sql
   -- Copy and paste from: chorehero-app/supabase/seed-data.sql
   -- This creates demo users, cleaners, and sample bookings
   ```

### **Step 2: Test as Demo Customer**

#### **A. Login as Demo Customer**
1. **Open ChoreHero App**
2. **Choose "Continue as Guest"** (this creates demo customer)
3. **Verify Demo Mode**: Look for "Demo Mode • Limited features" in profile

#### **B. Access Heroes Feed with Videos**
1. **Navigate to Heroes Tab** (or Content/Video Feed)
2. **Verify Videos Load**: You should see cleaner videos
3. **Look for Cleaner Profiles**: Each video should have cleaner info

#### **C. Book a Service from Video**
1. **Find a Video**: Pick any cleaner's video
2. **Tap Cleaner Profile**: Should show cleaner info card
3. **Tap "Book Service"** button
4. **Complete Booking Flow**:
   - Service Type: Choose any (kitchen, bathroom, etc.)
   - Date/Time: Default is tomorrow at 2 PM
   - Special Instructions: Add any notes
   - **Tap "Book Now"**

#### **Expected Result**: 
✅ "Booking Confirmed!" alert appears  
✅ Real database record created  
✅ Notifications sent to cleaners  

### **Step 3: Test as Demo Cleaner**

#### **A. Switch to Cleaner Account**
1. **Go to Settings** (gear icon in profile)
2. **Tap "Switch Accounts"**
3. **Choose to switch to Cleaner**
4. **Verify Cleaner Mode**: Should see cleaner navigation (Heroes, Jobs, Content, Messages, Profile)

#### **B. Check for New Job**
1. **Navigate to "Jobs" Tab**
2. **Look for Available Jobs**: Should see the booking from Step 2
3. **Verify Job Details**: Customer name, service type, time, price

#### **C. Accept the Job**
1. **Tap "Accept" on the booking**
2. **Confirm Acceptance**

#### **Expected Result**:
✅ Job status changes to "confirmed"  
✅ Chat room automatically created  
✅ Welcome message sent  
✅ Customer gets notification  

### **Step 4: Test Messaging**

#### **A. Open Chat (as Cleaner)**
1. **From Jobs tab**: Tap "Chat" button on accepted job
2. **Or from Messages tab**: Look for conversation

#### **B. Send Messages**
1. **Type a message**: "Hi! I'm excited to help with your cleaning!"
2. **Send message**
3. **Verify it appears**: Message should show immediately

#### **C. Test Customer Side**
1. **Switch back to Customer** (Settings → Switch Accounts)
2. **Go to Messages tab**
3. **Open conversation** with cleaner
4. **Send reply**: Test two-way messaging

#### **Expected Result**:
✅ Real-time messaging works  
✅ Messages persist in database  
✅ Both parties can communicate  

### **Step 5: Verify Database Records**

If you have access to Supabase dashboard:

1. **Check Bookings Table**:
   ```sql
   SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5;
   ```

2. **Check Chat Rooms**:
   ```sql
   SELECT * FROM chat_rooms ORDER BY created_at DESC LIMIT 5;
   ```

3. **Check Messages**:
   ```sql
   SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 10;
   ```

## 🔍 Troubleshooting

### **If Videos Don't Show**
- Check console for errors
- Verify demo toggle is working
- Make sure content service is loading properly

### **If Booking Fails**
- Check console logs for: `🎭 Demo user creating real booking`
- Verify demoBookingService import is working
- Ensure demo customer ID is valid

### **If Chat Doesn't Work**
- Verify messaging schema is installed
- Check for chat room creation logs: `🏠 Creating chat room for booking`
- Ensure messageService is properly imported

### **If Cleaner Jobs Don't Show**
- Verify seed data has demo cleaners
- Check if notifications were created
- Ensure cleaner account is seeing real data

## ✅ Success Indicators

### **Complete End-to-End Success**:
1. ✅ Customer books from Heroes feed
2. ✅ Real database booking created  
3. ✅ Cleaner sees job in Jobs tab
4. ✅ Cleaner accepts job
5. ✅ Chat room auto-created
6. ✅ Two-way messaging works
7. ✅ All data persists in database

### **Console Logs to Look For**:
- `🎭 Demo user creating real booking`
- `✅ Real booking created for demo user`
- `🏠 Creating chat room for booking`
- `✅ Chat room created successfully`
- `💬 Sending message to room`

## 🎯 What This Proves

When this test passes, you have:
- ✅ **Functional Marketplace**: Customers can discover and book cleaners
- ✅ **Real Database Operations**: Demo actions create actual records
- ✅ **Notification System**: Job alerts work
- ✅ **Messaging Platform**: Real-time communication
- ✅ **MVP-Ready Backend**: Scalable to real users

This demonstrates a **fully operational booking platform** ready for production users! 🚀