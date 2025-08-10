# ChoreHero Production Readiness Checklist

## ❌ Discover Tab Category Filtering - CRITICAL GAPS

### Required Database Changes:
1. **Expand Services Table**
   - Add room-specific service categories (Kitchen, Bathroom, Living Room, Bedroom, Outdoors)
   - Create service subcategories table
   - Link services to room types

2. **Update Cleaner Specialties**
   - Standardize specialty values to match UI categories
   - Add room-specific specialties to existing cleaner profiles
   - Create specialty-service mapping table

### Required API/Service Changes:
3. **Create Category Service**
   ```typescript
   // src/services/category.ts
   - getServicesByCategory(category: string)
   - getCleanersBySpecialty(specialty: string) 
   - getPopularServicesForCategory(category: string)
   - getRecommendedServicesForUser(userId: string, category?: string)
   ```

4. **Update DiscoverScreen**
   - Connect category tabs to real database queries
   - Filter Popular Services by selected category
   - Filter Trending Cleaners by specialty matching category
   - Filter Recommended Services by category + user history

### Database Schema Updates Needed:
```sql
-- Add room-specific services
INSERT INTO services (name, category, room_type, base_price, estimated_duration) VALUES
('Kitchen Deep Clean', 'cleaning', 'kitchen', 89.00, 150),
('Bathroom Sanitization', 'cleaning', 'bathroom', 75.00, 90),
('Living Room Detailing', 'cleaning', 'living_room', 65.00, 120);

-- Update cleaner specialties to match UI categories
UPDATE cleaner_profiles 
SET specialties = ARRAY['Kitchen', 'Bathroom', 'Living Room'] 
WHERE specialties @> ARRAY['General Cleaning'];
```

### UI Logic Updates Required:
5. **Category State Management**
   - selectedCategory should trigger API calls
   - Loading states for each section
   - Error handling for failed queries
   - Empty states when no results

6. **Real-time Updates**
   - Services should update when category changes
   - Cleaners should filter by matching specialties
   - Recommendations should be category-aware

### Current State:
- ✅ UI Design complete
- ✅ Navigation works
- ✅ Basic data structures exist
- ❌ Category filtering logic missing
- ❌ Database queries not connected
- ❌ Static mock data only

### Estimated Development Time:
- Database updates: 2-3 hours
- Service layer: 4-6 hours  
- UI integration: 3-4 hours
- Testing: 2-3 hours
- **Total: 11-16 hours**

### Priority: 🔴 CRITICAL
Without this functionality, users clicking category tabs see no difference, creating a broken user experience. 