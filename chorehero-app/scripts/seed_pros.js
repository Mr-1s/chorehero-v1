#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const seedPros = [
  {
    email: 'marcus.rivera+seed@chorehero.app',
    phone: '+15550000001',
    name: 'Marcus Rivera',
    title: 'The Deep Clean Specialist',
    bio: 'Expert in eco-friendly deep cleaning and organization.',
    hourly_rate: 55,
    rating_average: 4.9,
    rating_count: 128,
    videos: [
      'https://assets.mixkit.co/videos/45041/45041-720.mp4',
      'https://videos.pexels.com/video-files/4238551/4238551-hd_1920_1080_30fps.mp4',
      'https://videos.pexels.com/video-files/32010552/13643261_1080_1920_30fps.mp4',
    ],
    thumbnails: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1581579185169-1c4f3f4d3f24?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1581578731538-3b59bfe3b8a7?w=600&h=900&fit=crop',
    ],
    city: 'Atlanta',
    state: 'GA',
    specialties: ['deep_clean', 'eco_friendly', 'organization'],
  },
  {
    email: 'sarah.jenkins+seed@chorehero.app',
    phone: '+15550000002',
    name: 'Sarah Jenkins',
    title: 'The Quick-Fix Handyman',
    bio: 'Certified handyman for furniture assembly and light repairs.',
    hourly_rate: 65,
    rating_average: 4.8,
    rating_count: 95,
    videos: [
      'https://media.istockphoto.com/id/2190846629/video/professional-housecleaners-in-a-home.mp4?s=mp4-640x640-is&k=20&c=xnaktEavi0IWcR85pfyn8f29jaNtNcnS9B3y4HbA17Q=',
      'https://videos.pexels.com/video-files/32010552/13643261_1080_1920_30fps.mp4',
      'https://videos.pexels.com/video-files/6872063/6872063-uhd_2560_1440_25fps.mp4',
    ],
    thumbnails: [
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&h=900&fit=crop',
    ],
    city: 'Atlanta',
    state: 'GA',
    specialties: ['handyman', 'assembly', 'repairs'],
  },
  {
    email: 'david.chen+seed@chorehero.app',
    phone: '+15550000003',
    name: 'David Chen',
    title: 'The Garden Hero',
    bio: 'Transforming outdoor spaces with precision lawn care.',
    hourly_rate: 45,
    rating_average: 5.0,
    rating_count: 42,
    videos: [
      'https://assets.mixkit.co/videos/49024/49024-720.mp4',
      'https://assets.mixkit.co/videos/14383/14383-720.mp4',
      'https://www.pexels.com/video/man-using-drywall-sander-6473934/',
    ],
    thumbnails: [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&h=900&fit=crop',
      'https://images.unsplash.com/photo-1581579185169-9e1f2b6f1a1a?w=600&h=900&fit=crop',
    ],
    city: 'Atlanta',
    state: 'GA',
    specialties: ['lawn_care', 'landscaping', 'outdoor'],
  },
];

const ZIP_CODE = '99999';

const findAuthUserByEmail = async (email) => {
  if (typeof supabase.auth.admin.getUserByEmail === 'function') {
    const { data, error } = await supabase.auth.admin.getUserByEmail(email);
    if (error) throw error;
    return data.user || null;
  }
  if (typeof supabase.auth.admin.listUsers === 'function') {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200, page: 1 });
    if (error) throw error;
    const user = (data?.users || []).find((u) => u.email === email);
    return user || null;
  }
  return null;
};

const createAuthUser = async (email, phone) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    phone,
    email_confirm: true,
  });
  if (!error && data?.user) return data.user;
  if (error && error.code === 'email_exists') {
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw error;
    return existing;
  }
  throw error;
};

const upsertPublicUser = async (userId, { name, email, phone }) => {
  const payload = {
    id: userId,
    name,
    email,
    phone,
    role: 'cleaner',
    is_active: true,
    cleaner_onboarding_state: 'LIVE',
    cleaner_onboarding_step: 6,
  };
  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

const upsertCleanerProfile = async (userId, pro) => {
  const { error } = await supabase.from('cleaner_profiles').upsert(
    {
      user_id: userId,
      hourly_rate: pro.hourly_rate,
      rating_average: pro.rating_average,
      rating_count: pro.rating_count,
      bio: pro.bio,
      specialties: pro.specialties,
      verification_status: 'verified',
      is_available: true,
      background_check_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
};

const upsertAddress = async (userId, pro) => {
  const { error } = await supabase.from('addresses').insert({
    user_id: userId,
    street: '123 Test St',
    city: pro.city,
    state: pro.state,
    zip_code: ZIP_CODE,
    country: 'US',
    is_default: true,
  });
  if (error) throw error;
};

const insertContentPost = async (userId, pro) => {
  const { error: cleanupError } = await supabase
    .from('content_posts')
    .delete()
    .eq('user_id', userId);
  if (cleanupError) throw cleanupError;

  const videos = Array.isArray(pro.videos) && pro.videos.length ? pro.videos : [];
  const thumbnails = Array.isArray(pro.thumbnails) && pro.thumbnails.length ? pro.thumbnails : [];
  const payload = videos.map((mediaUrl, index) => ({
    user_id: userId,
    title: pro.title,
    description: pro.bio,
    content_type: 'video',
    media_url: mediaUrl,
    thumbnail_url: thumbnails[index] || null,
    status: 'published',
    published_at: new Date().toISOString(),
    view_count: Math.floor(Math.random() * 500) + 200,
    like_count: Math.floor(Math.random() * 200) + 50,
  }));
  if (!payload.length) return;
  const { error } = await supabase.from('content_posts').insert(payload);
  if (error) throw error;
};

const seed = async () => {
  console.log('Seeding test pros...');
  for (const pro of seedPros) {
    const authUser = await createAuthUser(pro.email, pro.phone);
    await upsertPublicUser(authUser.id, pro);
    await upsertCleanerProfile(authUser.id, pro);
    await upsertAddress(authUser.id, pro);
    await insertContentPost(authUser.id, pro);
    console.log(`✓ Seeded ${pro.name}`);
  }
  console.log('Done.');
};

const cleanup = async () => {
  console.log('Cleaning up seeded pros...');
  const emails = seedPros.map(p => p.email);
  const { data: users } = await supabase.from('users').select('id, email').in('email', emails);
  const ids = (users || []).map(u => u.id);
  if (ids.length === 0) {
    console.log('No seeded users found.');
    return;
  }
  await supabase.from('content_posts').delete().in('user_id', ids);
  await supabase.from('cleaner_profiles').delete().in('user_id', ids);
  await supabase.from('addresses').delete().in('user_id', ids);
  await supabase.from('users').delete().in('id', ids);
  for (const id of ids) {
    await supabase.auth.admin.deleteUser(id);
  }
  console.log('Cleanup complete.');
};

const action = process.argv[2];
if (action === 'clean') {
  cleanup().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
