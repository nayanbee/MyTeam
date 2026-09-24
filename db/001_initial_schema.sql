-- MyTeam V1 starter schema
-- Baseline only: designed to be refined through migrations during implementation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  default_timezone text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text UNIQUE,
  email text,
  preferred_name text,
  timezone text,
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organisation_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  person_id uuid NOT NULL REFERENCES people(id),
  status text NOT NULL DEFAULT 'active',
  roles text[] NOT NULL DEFAULT ARRAY['instructor']::text[],
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, person_id)
);

CREATE TABLE studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  name text NOT NULL,
  timezone text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  latitude numeric,
  longitude numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE studio_access (
  membership_id uuid NOT NULL REFERENCES organisation_memberships(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  access_level text NOT NULL DEFAULT 'standard',
  PRIMARY KEY (membership_id, studio_id)
);

CREATE TABLE instructor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_membership_id uuid NOT NULL UNIQUE REFERENCES organisation_memberships(id),
  display_name text NOT NULL,
  bio text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  name text NOT NULL,
  category text,
  duration_minutes integer,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE recurring_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  class_type_id uuid NOT NULL REFERENCES class_types(id),
  label text,
  canonical_weekday smallint NOT NULL CHECK (canonical_weekday BETWEEN 0 AND 6),
  canonical_time_band text NOT NULL,
  active_from date,
  active_to date,
  lineage_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recurring_slot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_slot_id uuid NOT NULL REFERENCES recurring_slots(id),
  effective_from date NOT NULL,
  effective_to date,
  local_start_time time NOT NULL,
  duration_minutes integer NOT NULL,
  class_type_id uuid NOT NULL REFERENCES class_types(id),
  nominal_capacity integer,
  change_reason text,
  UNIQUE (recurring_slot_id, effective_from)
);

CREATE TABLE class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  studio_id uuid NOT NULL REFERENCES studios(id),
  recurring_slot_id uuid REFERENCES recurring_slots(id),
  class_type_id uuid NOT NULL REFERENCES class_types(id),
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  nominal_capacity integer,
  sellable_capacity integer,
  status text NOT NULL DEFAULT 'scheduled',
  is_cancelled boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_sessions_org_start_idx ON class_sessions(organisation_id, scheduled_start);
CREATE INDEX class_sessions_studio_start_idx ON class_sessions(studio_id, scheduled_start);
CREATE INDEX class_sessions_slot_start_idx ON class_sessions(recurring_slot_id, scheduled_start);

CREATE TABLE session_instructors (
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  instructor_profile_id uuid NOT NULL REFERENCES instructor_profiles(id),
  role text NOT NULL DEFAULT 'primary',
  attribution_weight numeric,
  is_substitute boolean NOT NULL DEFAULT false,
  PRIMARY KEY (class_session_id, instructor_profile_id)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  first_name text,
  last_name text,
  email text,
  date_of_birth date,
  communication_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  created_at_source timestamptz,
  cancelled_at_source timestamptz,
  current_status text NOT NULL,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_session_status_idx ON reservations(class_session_id, current_status);
CREATE INDEX reservations_customer_session_idx ON reservations(customer_id, class_session_id);
CREATE INDEX reservations_created_source_idx ON reservations(created_at_source);

CREATE TABLE reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  source_event_id text,
  payload_hash text,
  provenance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  reservation_id uuid NOT NULL UNIQUE REFERENCES reservations(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  status text NOT NULL,
  checked_in_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_customer_checkin_idx ON attendance(customer_id, checked_in_at);
CREATE INDEX attendance_session_status_idx ON attendance(class_session_id, status);

CREATE TABLE integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  provider text NOT NULL,
  provider_tenant_id text,
  credential_secret_reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_successful_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_identity_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id uuid NOT NULL REFERENCES integration_connections(id),
  entity_type text NOT NULL,
  myteam_entity_id uuid NOT NULL,
  external_id text NOT NULL,
  external_parent_id text,
  source_updated_at timestamptz,
  UNIQUE (integration_connection_id, entity_type, external_id)
);

CREATE TABLE demand_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  captured_at timestamptz NOT NULL,
  minutes_to_start integer NOT NULL,
  active_reservations integer NOT NULL,
  gross_reservations integer,
  cancellations integer,
  waitlist_count integer,
  sellable_capacity integer,
  fill_pct numeric,
  source text NOT NULL,
  UNIQUE (class_session_id, captured_at)
);

CREATE TABLE demand_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  current_bookings integer NOT NULL,
  expected_now numeric NOT NULL,
  variance_absolute numeric NOT NULL,
  variance_pct numeric,
  projected_final_low numeric,
  projected_final_high numeric,
  demand_state text NOT NULL,
  confidence numeric,
  model_version text NOT NULL,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  feature_snapshot jsonb
);

CREATE TABLE context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  source_name text NOT NULL,
  captured_at timestamptz NOT NULL,
  valid_for timestamptz,
  feature_type text NOT NULL,
  features jsonb NOT NULL
);

-- Remaining cover, feedback, analytics, compliance and communications
-- tables are specified in docs/ERD_SCHEMA.md and should be added as
-- module migrations rather than one giant initial migration.
