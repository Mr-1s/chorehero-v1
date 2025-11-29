# 🎴 Service Card Template System

## 📋 **Complete Data Format for Service Cards**

You now have a **comprehensive, standardized format** for all service cards across ChoreHero! This ensures consistency whether the data comes from:
- 🎭 Guest mode demo services  
- 🗄️ Real database services
- 📹 Video content from cleaners
- 👤 Cleaner showcases

---

## 🏗️ **Core Service Card Structure**

### **📊 Complete Data Interface:**
```typescript
interface ServiceCardData {
  // Essential Identifiers
  id: string;
  type: 'service' | 'video' | 'cleaner_showcase' | 'category';
  
  // Display Content
  title: string;
  description: string;
  category: string; // 'kitchen', 'bathroom', 'living_room', 'bedroom'
  
  // Visual Media
  media: {
    primary_image_url: string;
    fallback_image_url?: string;
    video_url?: string; // For video cards
    thumbnail_url?: string;
    media_type: 'image' | 'video';
    alt_text?: string;
  };
  
  // Pricing Information
  pricing: {
    base_price?: number; // In cents
    price_range?: string; // "$80-120"
    price_display: string; // "From $80"
    currency: string;
    is_estimate: boolean;
  };
  
  // Service Details
  service_details: {
    estimated_duration: string; // "2-3 hours"
    duration_minutes?: number;
    difficulty_level?: 'basic' | 'standard' | 'deep' | 'premium';
    included_tasks?: string[];
    room_types?: string[];
  };
  
  // Quality Indicators
  rating: {
    average_rating: number; // 0-5
    total_reviews: number;
    rating_display: string; // "4.9"
    trust_indicators?: string[];
  };
  
  // Provider Info (for cleaner cards)
  provider?: {
    cleaner_id: string;
    cleaner_name: string;
    cleaner_avatar?: string;
    specialties: string[];
    is_verified: boolean;
  };
  
  // Engagement (for video cards)
  engagement?: {
    view_count: number;
    like_count: number;
    view_display: string; // "15.4K views"
  };
  
  // Availability & Booking
  availability: {
    is_available: boolean;
    booking_window: string; // "Same day", "Next day"
    is_emergency_service: boolean;
  };
  
  // Actions
  actions: {
    primary_action: 'book_now' | 'browse_cleaners' | 'view_details';
    primary_action_text: string;
    navigation_params?: Record<string, any>;
  };
  
  // Metadata
  metadata: {
    created_at: string;
    is_featured: boolean;
    tags: string[];
  };
}
```

---

## 🎨 **Visual Card Variants**

Your service cards can be displayed in **5 different layouts**:

### **1. 📱 Compact (Default)**
- **Size**: `(screen_width - 56) / 2 × 220px`
- **Usage**: Grid layouts, discovery page
- **Features**: Image overlay, rating badge, action button

### **2. 🌟 Featured**  
- **Size**: `screen_width - 40 × 280px`
- **Usage**: Hero sections, promoted services
- **Features**: Large imagery, detailed info, prominent CTA

### **3. 📋 List**
- **Size**: `screen_width - 40 × 120px`  
- **Usage**: Search results, category browsing
- **Features**: Horizontal layout, text focus

### **4. 📹 Video**
- **Size**: `200 × 280px`
- **Usage**: Video content, cleaner showcases
- **Features**: Play button, engagement stats, creator info

### **5. ✨ Minimal**
- **Size**: `(screen_width - 56) / 2 × 160px`
- **Usage**: Quick browse, comparison views
- **Features**: Clean design, essential info only

---

## 🛠️ **Easy Implementation**

### **📦 Using the Service Card Component:**
```typescript
import { ServiceCard } from '../components/ServiceCard';
import { serviceCardService } from '../services/serviceCardService';

// Create a standard service card
const kitchenCard = serviceCardService.createServiceCard({
  id: 'kitchen-001',
  title: 'Kitchen Deep Clean',
  description: 'Professional kitchen cleaning with degreasing',
  category: 'kitchen',
  price_range: '$80-120',
  duration: '2-3 hours',
  rating: 4.9,
  reviews: 234
});

// Render the card
<ServiceCard 
  data={kitchenCard}
  variant="compact"
  onPress={(data) => navigation.navigate('ServiceDetail', data.actions.navigation_params)}
/>
```

### **🔄 Transform Existing Data:**
```typescript
// Transform guest mode services
const guestServices = await guestModeService.getGuestServiceCategories();
const serviceCards = serviceCardService.transformToServiceCards(guestServices, 'guest_services');

// Transform video content
const videoContent = await contentService.getFeed();
const videoCards = serviceCardService.transformToServiceCards(videoContent.posts, 'video_content');

// Transform database services
const dbServices = await serviceDiscoveryService.getServices();
const dbCards = serviceCardService.transformToServiceCards(dbServices, 'database_services');
```

---

## 🎯 **Predefined Templates**

### **🍳 Kitchen Deep Clean**
```typescript
{
  title: "Kitchen Deep Clean",
  description: "Professional kitchen cleaning with degreasing, appliance cleaning, and sanitization",
  category: "kitchen",
  price_range: "$80-120",
  duration: "2-3 hours",
  rating: 4.9,
  included_tasks: [
    "Degrease all surfaces",
    "Clean inside/outside appliances", 
    "Sanitize countertops and sink",
    "Organize cabinets",
    "Deep clean stovetop and oven"
  ]
}
```

### **🚿 Bathroom Deep Clean**
```typescript
{
  title: "Bathroom Deep Clean",
  description: "Complete bathroom sanitization including grout cleaning and tile restoration",
  category: "bathroom", 
  price_range: "$60-90",
  duration: "1-2 hours",
  rating: 4.8,
  included_tasks: [
    "Scrub and disinfect toilet",
    "Clean shower/tub and remove soap scum",
    "Polish mirrors and fixtures",
    "Mop and sanitize floors",
    "Organize toiletries"
  ]
}
```

### **🛋️ Living Room Refresh**
```typescript
{
  title: "Living Room Refresh",
  description: "Carpet cleaning, upholstery care, and complete living space organization",
  category: "living_room",
  price_range: "$90-150", 
  duration: "2-4 hours",
  rating: 4.7,
  included_tasks: [
    "Vacuum and clean carpets",
    "Dust furniture and electronics",
    "Clean upholstery",
    "Organize entertainment center",
    "Polish wood surfaces"
  ]
}
```

### **🛏️ Bedroom Refresh**
```typescript
{
  title: "Bedroom Refresh",
  description: "Mattress cleaning, closet organization, and thorough dusting service",
  category: "bedroom",
  price_range: "$70-100",
  duration: "1-3 hours", 
  rating: 4.6,
  included_tasks: [
    "Change and wash bedding",
    "Vacuum mattress and floors",
    "Dust surfaces and organize",
    "Clean mirrors and windows",
    "Organize closet space"
  ]
}
```

---

## 🎨 **Visual Styling Features**

### **📸 Smart Image Handling**
- **Primary image** with **fallback** for loading errors
- **Professional stock photos** for each category
- **Video thumbnails** for video content
- **Loading states** with skeleton screens

### **🏆 Trust Indicators**
- **Star ratings** with review counts
- **Verification badges** for cleaners
- **Trust indicators**: "verified", "background_checked", "insured"
- **Featured/promoted** badges

### **💰 Flexible Pricing Display**
- **Range pricing**: "$80-120"
- **Starting pricing**: "From $65"
- **Contact pricing**: "Contact for pricing"
- **Estimated vs fixed** pricing indicators

### **⚡ Engagement Metrics**
- **View counts**: "15.4K views"
- **Like counts**: Heart icons with numbers
- **Professional formatting**: Large numbers → "1.2M", "5.6K"

---

## 🔧 **Integration with Your Current Screens**

### **📱 Discover Screen Update:**
```typescript
// Replace current service rendering with:
const renderServiceCard = (service: any) => {
  const cardData = serviceCardService.createServiceCard({
    id: service.id,
    title: service.name,
    description: service.description,
    category: service.category,
    price_range: service.price_range,
    rating: service.rating,
    custom_image: service.image_url
  });
  
  return (
    <ServiceCard 
      data={cardData}
      variant="compact"
      onPress={(data) => handleServicePress(data)}
    />
  );
};
```

### **📹 Video Feed Integration:**
```typescript
// Transform video content to service cards:
const videoCards = videoContent.map(video => 
  serviceCardService.createVideoServiceCard({
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category,
    video_url: video.media_url,
    thumbnail_url: video.thumbnail_url,
    cleaner_id: video.user.id,
    cleaner_name: video.user.name,
    view_count: video.view_count,
    like_count: video.like_count
  })
);
```

---

## ✅ **Benefits of This System**

### **🎯 Consistency**
- **Unified data structure** across all service types
- **Consistent visual design** with customizable variants
- **Standardized interactions** and navigation patterns

### **🔧 Flexibility** 
- **Multiple display variants** for different contexts
- **Easy data transformation** from any source
- **Customizable themes** and styling options

### **📊 Rich Data**
- **Comprehensive metadata** for analytics
- **SEO-friendly** content structure
- **Accessibility** features built-in

### **🚀 Developer Experience**
- **Type-safe** TypeScript interfaces
- **Validation** and error handling
- **Easy testing** with predefined templates
- **Backward compatibility** with legacy data

---

## 🎉 **Ready to Use!**

Your service card system is now **production-ready** with:

✅ **Complete data structure** covering all use cases  
✅ **5 visual variants** for different layouts  
✅ **4 predefined templates** for common services  
✅ **Automatic data transformation** from any source  
✅ **Professional styling** with trust indicators  
✅ **Type safety** and validation  

**This system ensures that whether your data comes from guest mode, real database, video content, or cleaner profiles - it will all display beautifully and consistently!** 🎨✨
