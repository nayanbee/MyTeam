-- Durable workflow model for implementation once PostgreSQL and authenticated
-- accounts are connected. No preview data is written to these tables yet.
CREATE TABLE cover_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  owner_id uuid REFERENCES people(id),
  assigned_manager_id uuid NOT NULL REFERENCES people(id),
  source_session_id uuid REFERENCES class_sessions(id),
  status text NOT NULL CHECK (status IN ('open','filled','withdrawn','closed')),
  urgent boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE TABLE cover_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_request_id uuid NOT NULL REFERENCES cover_requests(id),
  source_session_id uuid REFERENCES class_sessions(id),
  starts_at timestamptz NOT NULL,
  assigned_instructor_id uuid REFERENCES people(id),
  status text NOT NULL CHECK (status IN ('open','filled','reopened','closed')),
  source_status text NOT NULL DEFAULT 'pending' CHECK (source_status IN ('pending','verify_pending','verified','mismatch')),
  source_marked_at timestamptz,
  verify_after timestamptz,
  source_checked_at timestamptz,
  observed_source_instructor_id uuid REFERENCES people(id),
  UNIQUE (cover_request_id, starts_at)
);
CREATE TABLE cover_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_class_id uuid NOT NULL REFERENCES cover_classes(id),
  instructor_id uuid NOT NULL REFERENCES people(id),
  status text NOT NULL CHECK (status IN ('pending','approved','not_selected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (cover_class_id, instructor_id)
);
CREATE TABLE cover_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_class_id uuid NOT NULL REFERENCES cover_classes(id),
  instructor_id uuid NOT NULL REFERENCES people(id),
  status text NOT NULL CHECK (status IN ('requested','approved','declined','not_selected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  UNIQUE (cover_class_id, instructor_id)
);
CREATE INDEX cover_invitations_active_idx ON cover_invitations(cover_class_id) WHERE status='requested';
CREATE TABLE external_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  brand_name text NOT NULL,
  private_location text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','connected')),
  authorized_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  label text NOT NULL,
  storage_reference text,
  expiry_date date,
  status text NOT NULL CHECK (status IN ('missing','review','verified','rejected','expired')),
  review_reason text,
  reviewed_by uuid REFERENCES people(id),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE manager_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES people(id),
  cover_request_id uuid REFERENCES cover_requests(id),
  cover_class_id uuid REFERENCES cover_classes(id),
  compliance_document_id uuid REFERENCES compliance_documents(id),
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
-- The service must lock cover_classes FOR UPDATE and count active invitations
-- in the same transaction before inviting or accepting. The two-invitation
-- cap and first acceptance cannot be enforced safely by a browser state update.
-- Reconciliation workers must check verify_after and compare *every* assigned
-- source_session_id against Mariana Tek before closing a cover request.
