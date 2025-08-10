-- Create users table for authentication and profile data
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    account_type VARCHAR(20) CHECK (account_type IN ('customer', 'cleaner')),
    profile_completed BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create index on account_type for filtering
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users(account_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own data
CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Create policy for users to update their own data
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Create policy for inserting new users (handled by auth service)
CREATE POLICY "Enable insert for service role" ON public.users
    FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.users IS 'User accounts for both customers and cleaners';
COMMENT ON COLUMN public.users.email IS 'Unique email address used for authentication';
COMMENT ON COLUMN public.users.password_hash IS 'Hashed password for security';
COMMENT ON COLUMN public.users.account_type IS 'Type of account: customer or cleaner';
COMMENT ON COLUMN public.users.profile_completed IS 'Whether user has completed onboarding';
COMMENT ON COLUMN public.users.email_verified IS 'Whether email address has been verified'; 