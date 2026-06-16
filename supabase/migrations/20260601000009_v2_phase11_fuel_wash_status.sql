-- V2 Phase 11 (N5/N6): add the "Both (fuel + wash)" bus status.
-- A bus that needs BOTH fueling and washing is set to 'fuel_wash'. The fueler
-- completes each task; the bus steps fuel_wash -> (wash | fuel) -> ready.
-- Date: 2026-06-03

ALTER TABLE public.buses
  DROP CONSTRAINT IF EXISTS buses_status_check;

ALTER TABLE public.buses
  ADD CONSTRAINT buses_status_check CHECK (status IN (
    'ready', 'in_service', 'charging', 'fuel', 'wash', 'fuel_wash',
    'maintenance_pmi', 'shopped_dvir', 'maintenance_repair',
    'safety_hold', 'salvage', 'training'
  ));
