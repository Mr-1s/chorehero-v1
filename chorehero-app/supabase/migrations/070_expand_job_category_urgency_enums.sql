-- Expand job_category and job_urgency for Post a Job dropdowns (additive only).

ALTER TYPE job_category ADD VALUE 'organizing';
ALTER TYPE job_category ADD VALUE 'handyman';
ALTER TYPE job_category ADD VALUE 'delivery';
ALTER TYPE job_category ADD VALUE 'pet_care';
ALTER TYPE job_category ADD VALUE 'tech_support';
ALTER TYPE job_category ADD VALUE 'laundry';
ALTER TYPE job_category ADD VALUE 'junk_removal';
ALTER TYPE job_category ADD VALUE 'other';

ALTER TYPE job_urgency ADD VALUE 'next_week';
ALTER TYPE job_urgency ADD VALUE 'this_weekend';
ALTER TYPE job_urgency ADD VALUE 'next_month';
ALTER TYPE job_urgency ADD VALUE 'morning';
ALTER TYPE job_urgency ADD VALUE 'afternoon';
ALTER TYPE job_urgency ADD VALUE 'evening';
