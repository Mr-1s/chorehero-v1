# Mock Data Toggle System Guide

## Overview

The ChoreHero app now includes a comprehensive mock data toggle system that allows you to experience the app in two modes:

1. **Mock Data Mode** - App shows realistic sample data for testing and demo purposes
2. **Empty State Mode** - App shows empty states to experience the real user journey

## Quick Start

### Global Toggle

To disable all mock data across the app:

```typescript
// In src/utils/constants.ts
export const MOCK_DATA_CONFIG = {
  ENABLED: false, // Set to false for empty states
  // ...
}
```

### Using the Development Toggle

In development mode (`__DEV__ = true`), you'll see a "Development Mode" toggle card in the cleaner dashboard that allows you to instantly switch between mock data and empty states without code changes.

## Configuration

### Global Settings

```typescript
MOCK_DATA_CONFIG = {
  ENABLED: boolean,  // Master switch for all mock data
  
  CLEANER: {
    DASHBOARD: boolean,    // Job opportunities, active jobs, earnings
    PROFILE: boolean,      // Profile data, videos, verification status  
    VIDEOS: boolean,       // Uploaded videos and analytics
    EARNINGS: boolean,     // Payment history and analytics
    SCHEDULE: boolean,     // Bookings and schedule
    JOBS: boolean,         // Job history and opportunities
  },
  
  CUSTOMER: {
    DASHBOARD: boolean,    // Upcoming bookings, recent activity, saved services
    PROFILE: boolean,      // Profile information and booking history
    DISCOVER: boolean,     // Available cleaners and their profiles
    TRACKING: boolean,     // Active job tracking
    BOOKINGS: boolean,     // Booking history and management
  },
  
  SHARED: {
    VIDEO_FEED: boolean,   // Cleaner video profiles
    MESSAGES: boolean,     // Chat conversations
    RATINGS: boolean,      // Reviews and ratings
    NOTIFICATIONS: boolean // Push notifications
  }
}
```

### Programmatic Control

```typescript
import { MockDataToggle } from '../utils/mockDataToggle';

// Check if mock data is enabled globally
if (MockDataToggle.isEnabled()) {
  // Show mock data
}

// Check if mock data is enabled for a specific feature
if (MockDataToggle.isEnabledForFeature('CLEANER', 'DASHBOARD')) {
  // Show mock dashboard data
}

// Get mock data or empty state
const jobData = MockDataToggle.getFeatureData(
  'CLEANER', 
  'JOBS', 
  mockJobs,     // Mock data to show when enabled
  []            // Empty array when disabled
);

// Toggle features at runtime
MockDataToggle.setFeatureEnabled('CLEANER', 'VIDEOS', false);
MockDataToggle.setGlobalEnabled(false);
```

## What Changes When Mock Data is Disabled

### Cleaner Experience

#### Dashboard (`CLEANER.DASHBOARD: false`)
- ✅ **Empty State**: "No job opportunities" with call-to-action to complete profile
- ✅ **Earnings**: $0 today, $0 weekly, 0 completed jobs
- ✅ **Active Jobs**: No active jobs section shown
- ✅ **Stats**: All metrics show zero/empty

#### Profile (`CLEANER.PROFILE: false`)
- **Profile Data**: Shows actual user data from authentication
- **Videos**: No uploaded videos
- **Verification**: Shows incomplete verification status
- **Bio/Specialties**: Empty fields

#### Videos (`CLEANER.VIDEOS: false`)
- ✅ **Empty State**: "No videos uploaded" with upload encouragement
- **Analytics**: 0 views, 0 bookings conversion
- **Portfolio**: Empty video grid

#### Earnings (`CLEANER.EARNINGS: false`)
- ✅ **Balance**: $0 current, $0 pending, $0 total
- ✅ **History**: Empty payment history
- **Analytics**: No earnings trends

### Customer Experience

#### Dashboard (`CUSTOMER.DASHBOARD: false`)
- ✅ **Upcoming Bookings**: Empty state with booking encouragement
- ✅ **Recent Activity**: Empty history
- ✅ **Saved Services**: No saved services

#### Profile (`CUSTOMER.PROFILE: false`)
- **User Data**: Shows real authenticated user information
- **Booking History**: Empty booking history
- **Preferences**: No saved preferences

#### Discover (`CUSTOMER.DISCOVER: false`)
- **Cleaners**: No available cleaners shown
- **Search Results**: Empty search results
- **Filters**: All filters show no results

### Shared Features

#### Video Feed (`SHARED.VIDEO_FEED: false`)
- **Feed**: Empty video feed with browse encouragement
- **Discovery**: No cleaner videos available

#### Messages (`SHARED.MESSAGES: false`)
- **Conversations**: Empty chat list
- **History**: No message history

## Empty State Components

All empty states use the centralized `EmptyState` component with predefined configurations:

```typescript
// Example usage
<EmptyState
  {...EmptyStateConfigs.jobOpportunities}
  actions={[
    {
      label: 'Complete Profile',
      onPress: () => navigation.navigate('Profile'),
      icon: 'person'
    }
  ]}
/>
```

### Available Empty State Configs

- `jobOpportunities` - For cleaner job listings
- `cleanerVideos` - For video upload screens
- `cleanerEarnings` - For earnings/payment screens
- `cleanerSchedule` - For booking schedule
- `cleanerProfile` - For incomplete profiles
- `customerBookings` - For customer booking history
- `discoverCleaners` - For cleaner search results
- `videoFeed` - For video discovery feed
- `conversations` - For chat/messaging
- `upcomingBookings` - For customer dashboard
- `recentActivity` - For activity history
- `savedServices` - For saved/favorite services

## Testing Different Scenarios

### 1. New Cleaner Onboarding
```typescript
// Disable all cleaner mock data
MockDataToggle.setAreaEnabled('CLEANER', false);
```
Experience:
- Empty dashboard with profile completion prompts
- No videos uploaded
- $0 earnings
- No job history

### 2. New Customer Experience  
```typescript
// Disable all customer mock data
MockDataToggle.setAreaEnabled('CUSTOMER', false);
```
Experience:
- Empty booking history
- No saved services
- Clean discovery experience

### 3. Selective Testing
```typescript
// Test just earnings flow
MockDataToggle.setFeatureEnabled('CLEANER', 'EARNINGS', false);
// Keep other features enabled
```

## Implementation Examples

### Screen Integration

```typescript
// In a screen component
const VideoUploadScreen = () => {
  const [videos, setVideos] = useState(
    MockDataToggle.getFeatureData('CLEANER', 'VIDEOS', mockVideos, [])
  );

  return (
    <View>
      {videos.length > 0 ? (
        <VideoList videos={videos} />
      ) : (
        <EmptyState {...EmptyStateConfigs.cleanerVideos} />
      )}
    </View>
  );
};
```

### Service Integration

```typescript
// In a service
export const getJobOpportunities = async () => {
  if (MockDataToggle.isEnabledForFeature('CLEANER', 'JOBS')) {
    return mockJobData;
  }
  
  // Make real API call
  return await api.get('/jobs/opportunities');
};
```

## Production Considerations

1. **Always disable mock data in production builds**
2. **Set `MOCK_DATA_CONFIG.ENABLED = false` before release**
3. **The dev toggle only appears when `__DEV__ = true`**
4. **Empty states provide clear calls-to-action for user engagement**

## Benefits

### For Development
- ✅ **Fast Testing**: Switch between states instantly
- ✅ **UX Validation**: Experience real user journeys
- ✅ **Edge Case Testing**: Test empty state interactions
- ✅ **Onboarding Flow**: Test new user experience

### For Users
- ✅ **Guided Experience**: Clear next steps when data is empty
- ✅ **Motivation**: Encouragement to complete profile/take actions
- ✅ **Clarity**: No confusion about what's real vs demo data
- ✅ **Performance**: Faster loading without unnecessary mock data

## Troubleshooting

### Mock Data Still Showing
1. Check `MOCK_DATA_CONFIG.ENABLED` is `false`
2. Verify specific feature flags are disabled
3. Restart the app to ensure state reset

### Empty States Not Appearing
1. Ensure `EmptyState` component is imported
2. Check that the condition properly checks data length
3. Verify empty state configs are correctly imported

### Dev Toggle Not Visible
1. Confirm `__DEV__` is `true`
2. Check you're viewing the cleaner dashboard
3. Verify proper import of `MockDataToggle`

This system provides a comprehensive way to experience ChoreHero as both a demonstration app and a real-world application ready for production use. 