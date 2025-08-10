# ChoreHero Beta Testing Setup Guide

## 🚨 **Email Confirmation Issue - URGENT FIX NEEDED**

### **The Problem:**
Beta testers receive Supabase email confirmation links that don't work, causing accounts to remain unconfirmed and users to fall back to demo mode.

### **Immediate Solution Options:**

#### **Option 1: Disable Email Confirmation (Recommended for Beta)**

**Supabase Dashboard Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your ChoreHero project
3. Navigate to **Authentication** → **Settings**
4. Under **User Signups**:
   - Set **Enable email confirmations** to `OFF`
   - Set **Enable phone confirmations** to `OFF` (if using phone auth)
5. Click **Save**

**Result:** Users can sign up and immediately use their accounts without email confirmation.

#### **Option 2: Configure Proper Email Redirect (Production Ready)**

**Supabase Dashboard Steps:**
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your app's URL scheme: `chorehero://`
3. Add **Redirect URLs**:
   - `chorehero://auth/callback`
   - `https://yourdomain.com/auth/callback` (if you have a website)

**App Configuration:**
```typescript
// In userService.ts, update the sign-up options:
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: email.toLowerCase(),
  password: password,
  options: {
    emailRedirectTo: 'chorehero://auth/callback'
  }
});
```

**Deep Link Handling:** (Requires additional setup)
- Configure app.json for deep linking
- Handle `chorehero://auth/callback` in the app

### **Current Temporary Workaround in Code:**

I've added error handling that detects when email confirmation is required:

```typescript
// User will see this message if email confirmation is enabled:
"Please check your email and click the confirmation link to activate your account. Then return to sign in."
```

### **Recommended Action for Beta Testing:**

**Use Option 1** - Disable email confirmation in Supabase settings for immediate beta testing.

1. **Disable email confirmation** in Supabase dashboard
2. **Test the sign-up flow** - users should go straight to onboarding
3. **Real accounts will work immediately** without email confirmation
4. **Re-enable for production** when ready to launch

### **Testing Verification:**

After disabling email confirmation:

1. **Sign up with new email** → Should go directly to account type selection
2. **Complete onboarding** → Should save to database
3. **Profile screen** → Should show "Real Account" status
4. **Console logs** → Should show "✅ REAL USER detected"
5. **Empty states** → Should appear for new users (no mock data)

### **Production Considerations:**

For production launch:
- **Re-enable email confirmation** for security
- **Implement proper deep linking** for email confirmation flow
- **Add email verification status** to user profiles
- **Handle unverified users** appropriately

---

## 🔧 **Current Beta Testing Status:**

- ✅ **Real Authentication**: Supabase integration working
- ✅ **Database Storage**: User profiles and onboarding data saved
- ✅ **Profile Integration**: Real vs demo user detection
- ✅ **Empty States**: Proper empty states for new users
- ⚠️ **Email Confirmation**: Needs to be disabled for beta testing
- ✅ **Navigation**: Fixed floating nav and profile labels

## 📝 **Next Steps:**

1. **Admin**: Disable email confirmation in Supabase dashboard
2. **Test**: Try sign-up flow again - should work immediately
3. **Verify**: Check profile shows real user data and empty states
4. **Proceed**: Beta testing can continue with real accounts 