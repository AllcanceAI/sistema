ALTER TABLE public.service_orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;