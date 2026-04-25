/**
 * Single source of truth for cleaner profile % (0–1) and incomplete item labels.
 * Keep in sync with any profile “completion” UI (Profile, Dashboard).
 */

export type ProfileCompletionField = { id: string; label: string; filled: boolean; weight: number };

const FIELD_SPECS: Array<{
  id: string;
  label: string;
  weight: number;
  filled: (profile: any, user: any) => boolean;
}> = [
  { id: 'avatar', label: 'Profile photo', weight: 1, filled: (p, u) => !!u?.avatar_url },
  {
    id: 'bio',
    label: 'Bio description',
    weight: 1,
    filled: (p, u) => !!(p?.bio && String(p.bio).trim().length > 10),
  },
  { id: 'video', label: 'Intro video', weight: 1, filled: (p) => !!p?.video_profile_url },
  {
    id: 'verification',
    label: 'ID verification',
    weight: 1,
    filled: (p) => p?.verification_status === 'verified',
  },
  {
    id: 'background',
    label: 'Background check',
    weight: 1,
    filled: (p) =>
      p?.background_check_status === 'cleared' ||
      p?.background_check_status === 'verified' ||
      !!p?.background_check_date,
  },
  {
    id: 'hourly_rate',
    label: 'Hourly rate',
    weight: 1,
    filled: (p) =>
      p?.hourly_rate != null && !Number.isNaN(Number(p.hourly_rate)) && Number(p.hourly_rate) > 0,
  },
  { id: 'specialties', label: 'Service specialties', weight: 1, filled: (p) => (p?.specialties?.length || 0) > 0 },
  {
    id: 'experience',
    label: 'Experience',
    weight: 1,
    filled: (p) =>
      p != null &&
      p.years_experience != null &&
      typeof p.years_experience === 'number' &&
      p.years_experience >= 0,
  },
  {
    id: 'coverage',
    label: 'Coverage area',
    weight: 1,
    filled: (p) => !!(p?.coverage_area && String(p.coverage_area).trim().length >= 3),
  },
];

export function computeProfileCompletionRatio(cleanerProfile: any, user: any | null | undefined): number {
  if (!cleanerProfile) return 0;
  const totalWeight = FIELD_SPECS.reduce((s, f) => s + f.weight, 0);
  const filledWeight = FIELD_SPECS.reduce((s, f) => s + (f.filled(cleanerProfile, user) ? f.weight : 0), 0);
  return totalWeight > 0 ? filledWeight / totalWeight : 0;
}

export function getProfileCompletionFields(cleanerProfile: any, user: any | null | undefined): ProfileCompletionField[] {
  if (!cleanerProfile) {
    return FIELD_SPECS.map((f) => ({
      id: f.id,
      label: f.label,
      filled: false,
      weight: f.weight,
    }));
  }
  return FIELD_SPECS.map((f) => ({
    id: f.id,
    label: f.label,
    filled: f.filled(cleanerProfile, user),
    weight: f.weight,
  }));
}

/**
 * Join `public.users` embed with app `user` (from auth) so avatar_url and other fields
 * resolve when the query join is empty or lags.
 */
export function mergeUserForProfileCompletion(dbUser: any, appUser: any | null | undefined): any | null {
  if (!dbUser && !appUser) return null;
  if (!appUser) return dbUser;
  if (!dbUser) return { ...appUser };
  return {
    ...appUser,
    ...dbUser,
    avatar_url: dbUser.avatar_url || appUser.avatar_url,
    name: dbUser.name || appUser.name,
  };
}

/** Routes registered on the cleaner main stack (RoleBasedTabNavigator). */
export type CleanerCompletionNavTarget =
  | 'CleanerProfileEdit'
  | 'EditProfileScreen'
  | 'SettingsScreen'
  | 'VideoUpload'
  | 'Content'
  | 'Profile';

/**
 * Next screen to finish the checklist — avoids sending pros to generic Edit Profile when
 * the gap is video, verification, or background.
 */
export function getNextCleanerCompletionNavTarget(
  incomplete: ProfileCompletionField[]
): CleanerCompletionNavTarget {
  if (incomplete.length === 0) {
    return 'Profile';
  }
  const id = incomplete[0].id;
  if (id === 'background' || id === 'verification') {
    return 'SettingsScreen';
  }
  if (id === 'video') {
    return 'VideoUpload';
  }
  return 'CleanerProfileEdit';
}
