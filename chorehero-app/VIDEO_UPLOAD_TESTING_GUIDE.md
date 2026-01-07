# 📹 Video Upload Testing Guide - ChoreHero Cleaners

## 🎯 Purpose
This guide helps testers verify that the cleaner video upload functionality works correctly on both iOS and Android devices.

## 🔧 Prerequisites
- ChoreHero app installed and updated to latest version
- Device with camera and photo library access
- Internet connection for upload testing
- At least 100MB free storage space

## 📱 How to Access Video Upload

### 1. Sign in as Cleaner
- Open ChoreHero app
- Choose "Demo Access" or create cleaner account
- Navigate to cleaner dashboard

### 2. Find Content Tab
- Look for bottom navigation tabs
- Tap "Content" tab (camera icon)
- This opens the Video Upload Screen

## 🧪 Testing Scenarios

### ✅ **TEST 1: Camera Recording**
**Steps:**
1. Tap "Record Video" button
2. Check if camera permission dialog appears
3. Grant camera permission
4. Record 10-30 second video
5. Stop recording and confirm
6. Check if video appears in preview

**Expected Results:**
- ✅ Permission dialog shows with clear message
- ✅ Camera opens successfully
- ✅ Recording controls are visible
- ✅ Video preview appears after recording
- ✅ Upload progress shows (if connected to internet)

**Common Issues:**
- ❌ Permission denied → Check device settings
- ❌ Camera won't open → Restart app
- ❌ Upload fails → Check internet connection

### ✅ **TEST 2: Library Selection**
**Steps:**
1. Tap "Choose from Library" button
2. Select existing video from photo library
3. Confirm selection
4. Check upload progress

**Expected Results:**
- ✅ Photo library opens
- ✅ Only videos are selectable
- ✅ Selected video shows in preview
- ✅ Upload starts automatically

### ✅ **TEST 3: Upload Progress**
**Steps:**
1. Upload any video (camera or library)
2. Watch upload progress bar
3. Note upload details (MB transferred)
4. Test cancel upload functionality

**Expected Results:**
- ✅ Progress bar shows 0-100%
- ✅ Data transfer details visible
- ✅ Cancel button works
- ✅ Success message on completion

### ✅ **TEST 4: Error Handling**
**Test Scenarios:**
- Upload very large video (>50MB)
- Upload unsupported format
- Upload with poor internet
- Upload while airplane mode

**Expected Results:**
- ✅ Clear error messages
- ✅ Retry options provided
- ✅ Offline uploads queue for later

## 🔍 Debug Information

### Console Logs to Watch For:
When testing, check console for these logs:
- `🎥 Starting camera upload...`
- `📷 Camera permission status: granted`
- `✅ Video selected from camera: [URI]`
- `📚 Library result: [Object]`

### Error Messages:
- **Camera Permission Required** → Normal, grant permission
- **File Too Large** → Use smaller video
- **Unsupported Format** → Use MP4, MOV, or AVI
- **Network Offline** → Check internet connection

## 📋 Testing Checklist

### Basic Functionality
- [ ] Can access Content tab
- [ ] Camera permission dialog appears
- [ ] Library permission works
- [ ] Video recording functions
- [ ] Video selection from library works
- [ ] Upload progress displays
- [ ] Cancel upload works
- [ ] Success messages appear

### Edge Cases
- [ ] Large file handling (>50MB)
- [ ] Poor network conditions
- [ ] Background/foreground switching
- [ ] Multiple rapid uploads
- [ ] Storage permission edge cases

### Visual Elements
- [ ] Progress bar animates smoothly
- [ ] Video preview displays correctly
- [ ] Upload buttons are responsive
- [ ] Analytics section updates
- [ ] Video list refreshes after upload

## 🐛 How to Report Issues

### Include This Information:
1. **Device:** iPhone 15 Pro / Samsung Galaxy S23, etc.
2. **OS Version:** iOS 17.1 / Android 14, etc.
3. **Steps:** Exactly what you did
4. **Expected:** What should have happened
5. **Actual:** What actually happened
6. **Error Message:** Any error text shown
7. **Console Logs:** If available in dev mode

### Example Bug Report:
```
Device: iPhone 14 Pro, iOS 17.2
Issue: Camera won't open when tapping "Record Video"
Steps: 
1. Opened app as cleaner
2. Tapped Content tab
3. Tapped "Record Video"
4. Permission dialog appeared
5. Granted permission
6. Camera screen shows black
Expected: Camera viewfinder should show
Console: "📷 Camera permission status: granted"
```

## 🚀 Success Criteria

The video upload feature is working correctly when:
- ✅ All permission flows work smoothly
- ✅ Camera and library access function
- ✅ Progress tracking is accurate
- ✅ Error messages are helpful
- ✅ Uploads complete successfully
- ✅ Videos appear in cleaner's content list
- ✅ Analytics update properly

## 🔧 Troubleshooting

### Camera Won't Open
1. Check app permissions in device settings
2. Restart app completely
3. Restart device if needed
4. Ensure camera isn't being used by another app

### Upload Keeps Failing
1. Check internet connection strength
2. Try smaller video files
3. Switch between WiFi and cellular
4. Check available storage space

### Permission Issues
1. Go to device Settings → Privacy → Camera
2. Ensure ChoreHero has permission
3. Same for Photos/Media access
4. Restart app after changing permissions

## 📞 Support Contact
If issues persist after trying troubleshooting steps, contact support with your detailed bug report.