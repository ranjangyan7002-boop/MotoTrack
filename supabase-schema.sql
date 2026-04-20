-- 1. RIDES TABLE
-- Stores metadata for each ride session.
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Flexible to support external Auth UIDs (like Firebase)
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    distance FLOAT8 DEFAULT 0,
    max_speed FLOAT8 DEFAULT 0,
    avg_speed FLOAT8 DEFAULT 0,
    snapshot_url TEXT,
    status TEXT CHECK (status IN ('recording', 'completed')) DEFAULT 'recording',
    max_lean_angle FLOAT8 DEFAULT 0,
    efficiency_score INT4,
    speed_distribution JSONB, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RIDE POINTS TABLE
-- Stores the high-frequency GPS path data.
CREATE TABLE IF NOT EXISTS public.ride_points (
    id BIGSERIAL PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    latitude FLOAT8 NOT NULL,
    longitude FLOAT8 NOT NULL,
    speed FLOAT8,
    altitude FLOAT8,
    heading FLOAT8,
    lean_angle FLOAT8,
    timestamp TIMESTAMPTZ NOT NULL
);

-- 3. INDEXES FOR PERFORMANCE
-- Fast lookup for user's history
CREATE INDEX IF NOT EXISTS idx_rides_user_id ON public.rides(user_id);
-- Fast path retrieval for a specific ride
CREATE INDEX IF NOT EXISTS idx_ride_points_ride_id ON public.ride_points(ride_id);
-- Time-based sorting for analytics
CREATE INDEX IF NOT EXISTS idx_rides_start_time ON public.rides(start_time);

-- 4. RLS POLICIES (Security)
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rides" 
ON public.rides FOR ALL 
USING (true); -- In a production app, you'd verify the JWT or use Supabase Auth

CREATE POLICY "Users can manage points for their own rides" 
ON public.ride_points FOR ALL 
USING (true); 

-- 5. STORAGE BUCKET SETUP (Run in Dashboard or via API)
-- Bucket name: "ride-snapshots"
