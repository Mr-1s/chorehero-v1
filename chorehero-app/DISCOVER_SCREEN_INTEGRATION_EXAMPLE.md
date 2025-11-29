# 🔗 Service Card Integration Example

## 📱 **How to Update Your Discover Screen**

Here's exactly how to integrate the new service card system into your existing Discover screen:

### **🔧 Step 1: Import the New Components**
```typescript
// Add these imports to DiscoverScreen.tsx
import { ServiceCard } from '../../components/ServiceCard';
import { serviceCardService } from '../../services/serviceCardService';
import { ServiceCardData } from '../../types/serviceCard';
```

### **🎨 Step 2: Replace Current Service Rendering**
```typescript
// Replace your current renderServiceCard function with:
const renderServiceCard = (service: any, isPopular = false) => {
  // Transform your existing service data to the new format
  const cardData = serviceCardService.createServiceCard({
    id: service.id,
    title: service.name || service.title,
    description: service.description,
    category: service.category,
    price_range: service.price_range,
    duration: service.estimated_duration ? `${service.estimated_duration} hours` : '2-3 hours',
    rating: service.rating || 4.8,
    reviews: service.reviews || 0,
    custom_image: service.image || service.image_url,
    is_featured: isPopular
  });

  return (
    <ServiceCard
      key={service.id}
      data={cardData}
      variant={isPopular ? "featured" : "compact"}
      onPress={(data) => handleServicePress(data)}
      onSecondaryAction={(data) => handleSaveService(data)}
      style={{ marginBottom: isPopular ? 0 : 16 }}
    />
  );
};
```

### **📹 Step 3: Update Video Content Rendering**
```typescript
// For your Featured Videos section:
const renderVideoCard = (video: any) => {
  const videoCard = serviceCardService.createVideoServiceCard({
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category || 'general',
    video_url: video.media_url,
    thumbnail_url: video.thumbnail_url || video.media_url,
    cleaner_id: video.user.id,
    cleaner_name: video.user.name,
    cleaner_avatar: video.user.avatar_url,
    view_count: video.view_count || 0,
    like_count: video.like_count || 0
  });

  return (
    <ServiceCard
      key={video.id}
      data={videoCard}
      variant="video"
      onPress={(data) => handleVideoPress(data)}
    />
  );
};
```

### **🏗️ Step 4: Update Your Grid Layout**
```typescript
// Replace your current grid rendering with:
<View style={styles.popularServicesGrid}>
  {serviceCategories.map((service, index) => 
    renderServiceCard(service, true)
  )}
</View>

// For horizontal video scrolling:
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {featuredVideos.map(video => renderVideoCard(video))}
</ScrollView>
```

### **⚡ Step 5: Handle Card Actions**
```typescript
// Add these handler functions:
const handleServicePress = (cardData: ServiceCardData) => {
  if (cardData.actions.primary_action === 'browse_cleaners') {
    navigation.navigate('ServiceDetail', {
      serviceId: cardData.id,
      serviceName: cardData.title,
      category: cardData.category,
      ...cardData.actions.navigation_params
    });
  } else if (cardData.actions.primary_action === 'view_details') {
    navigation.navigate('CleanerProfile', {
      cleanerId: cardData.provider?.cleaner_id
    });
  }
};

const handleVideoPress = (cardData: ServiceCardData) => {
  navigation.navigate('CleanerProfile', {
    cleanerId: cardData.provider?.cleaner_id,
    highlightVideo: cardData.id
  });
};

const handleSaveService = (cardData: ServiceCardData) => {
  // Handle save/bookmark functionality
  console.log('Saving service:', cardData.title);
};
```

---

## 🎯 **Current vs New Comparison**

### **📊 Your Current Format:**
```typescript
// What you have now:
{
  id: 'kitchen-deep-clean',
  name: 'Kitchen Deep Clean',
  description: 'Professional kitchen cleaning...',
  image_url: 'https://...',
  rating: 4.9,
  price_range: '$80-120',
  category: 'kitchen'
}
```

### **✨ New Standardized Format:**
```typescript
// What the service card system creates:
{
  id: 'kitchen-deep-clean',
  type: 'service',
  title: 'Kitchen Deep Clean',
  description: 'Professional kitchen cleaning...',
  category: 'kitchen',
  
  media: {
    primary_image_url: 'https://...',
    fallback_image_url: 'https://...',
    media_type: 'image'
  },
  
  pricing: {
    price_range: '$80-120',
    price_display: '$80-120',
    currency: 'USD',
    is_estimate: true
  },
  
  rating: {
    average_rating: 4.9,
    total_reviews: 234,
    rating_display: '4.9',
    trust_indicators: ['verified', 'background_checked']
  },
  
  service_details: {
    estimated_duration: '2-3 hours',
    included_tasks: ['Degrease surfaces', '...']
  },
  
  actions: {
    primary_action: 'browse_cleaners',
    primary_action_text: 'Browse Cleaners',
    navigation_params: { category: 'kitchen' }
  }
}
```

---

## 🎨 **Visual Improvements You'll Get**

### **✨ Enhanced Card Features:**
- **Loading states** with skeleton animations
- **Error handling** with fallback images
- **Trust badges** (verified, background checked)
- **Engagement metrics** for video content
- **Professional styling** with shadows and gradients
- **Haptic feedback** on interactions

### **📱 Responsive Design:**
- **Grid layout** - 2 cards per row on mobile
- **Featured cards** - Full width for promotions
- **List layout** - Horizontal for search results
- **Video cards** - Optimized for video content

### **🎯 Consistent Actions:**
- **"Browse Cleaners"** for service categories
- **"View Cleaner"** for video content
- **"Book Now"** for direct bookings
- **Secondary actions** like save/share

---

## 🚀 **Migration Benefits**

### **📈 Immediate Improvements:**
✅ **Consistent visual design** across all cards  
✅ **Better error handling** with fallback images  
✅ **Enhanced loading states** for better UX  
✅ **Rich metadata** for analytics tracking  
✅ **Type safety** preventing runtime errors  

### **🔮 Future-Proof:**
✅ **Easy to add new card types** (promotions, offers, etc.)  
✅ **A/B testing ready** with variant support  
✅ **Scalable** for different screen sizes  
✅ **Accessible** with proper alt text and labels  

---

## 💡 **Quick Start Integration**

### **🎯 Minimum Changes Required:**
1. **Add 3 imports** to your DiscoverScreen
2. **Replace renderServiceCard** function (5 lines)
3. **Add card action handlers** (2 functions)
4. **Update grid JSX** (minimal changes)

### **⚡ 10-Minute Integration:**
The new system is designed to be **drop-in compatible** with your existing data structure. Most of your current code can stay the same!

**Ready to upgrade your service cards with this professional, consistent system?** 🎨✨
