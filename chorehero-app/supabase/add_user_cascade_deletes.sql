-- Add ON DELETE CASCADE for user-related foreign keys
-- Safe to run multiple times; it drops existing FKs on the column and re-adds with CASCADE
DO $$
DECLARE
  existing_constraint RECORD;
  v_target_table TEXT;
  v_target_column TEXT;
  v_constraint_name TEXT;
BEGIN
  -- Helper to drop existing FK constraints on a specific column and re-add with CASCADE
  -- Cleaner profiles
  v_target_table := 'cleaner_profiles';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_cleaner_profiles_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Customer profiles
  v_target_table := 'customer_profiles';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_customer_profiles_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Addresses
  v_target_table := 'addresses';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_addresses_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Bookings (customer_id, cleaner_id)
  v_target_table := 'bookings';
  v_target_column := 'customer_id';
  v_constraint_name := 'fk_bookings_customer_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  v_target_table := 'bookings';
  v_target_column := 'cleaner_id';
  v_constraint_name := 'fk_bookings_cleaner_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Chat threads (customer_id, cleaner_id)
  v_target_table := 'chat_threads';
  v_target_column := 'customer_id';
  v_constraint_name := 'fk_chat_threads_customer_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  v_target_table := 'chat_threads';
  v_target_column := 'cleaner_id';
  v_constraint_name := 'fk_chat_threads_cleaner_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Chat messages (sender_id)
  v_target_table := 'chat_messages';
  v_target_column := 'sender_id';
  v_constraint_name := 'fk_chat_messages_sender_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Content posts
  v_target_table := 'content_posts';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_content_posts_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Content interactions
  v_target_table := 'content_interactions';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_content_interactions_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Saved content
  v_target_table := 'saved_content';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_saved_content_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- User follows (follower_id, following_id)
  v_target_table := 'user_follows';
  v_target_column := 'follower_id';
  v_constraint_name := 'fk_user_follows_follower_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  v_target_table := 'user_follows';
  v_target_column := 'following_id';
  v_constraint_name := 'fk_user_follows_following_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Notifications (user_id)
  v_target_table := 'notifications';
  v_target_column := 'user_id';
  v_constraint_name := 'fk_notifications_user_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  -- Reviews (if present)
  v_target_table := 'reviews';
  v_target_column := 'reviewer_id';
  v_constraint_name := 'fk_reviews_reviewer_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;

  v_target_table := 'reviews';
  v_target_column := 'reviewee_id';
  v_constraint_name := 'fk_reviews_reviewee_id';
  IF to_regclass('public.' || v_target_table) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns cols
      WHERE cols.table_schema = 'public' AND cols.table_name = v_target_table AND cols.column_name = v_target_column
     ) THEN
    FOR existing_constraint IN
      SELECT conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
      WHERE n.nspname = 'public' AND t.relname = v_target_table AND a.attname = v_target_column AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_target_table, existing_constraint.conname);
    END LOOP;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      v_target_table, v_constraint_name, v_target_column
    );
  END IF;
END $$;
