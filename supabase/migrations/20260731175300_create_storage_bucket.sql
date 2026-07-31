-- Create the storage bucket for vehicle order media if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('oficina-media', 'oficina-media', true)
ON CONFLICT (id) DO NOTHING;
