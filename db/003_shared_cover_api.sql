-- Run after 001 and 002 in a Supabase PostgreSQL project.
-- Supabase Auth users are mapped through people.auth_subject. Provision those
-- identities and owner_manager_assignments before enabling shared mode.
CREATE TABLE owner_manager_assignments (
  owner_id uuid PRIMARY KEY REFERENCES people(id),
  manager_id uuid NOT NULL REFERENCES people(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cover_requests ADD COLUMN IF NOT EXISTS external_key text;
ALTER TABLE cover_classes ADD COLUMN IF NOT EXISTS label text;
CREATE TABLE cover_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id),
  cover_request_id uuid REFERENCES cover_requests(id),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX cover_notifications_person_time_idx ON cover_notifications(person_id,created_at DESC);

CREATE OR REPLACE FUNCTION myteam_cover_snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE me people%ROWTYPE; membership organisation_memberships%ROWTYPE;
BEGIN
  SELECT * INTO me FROM people WHERE auth_subject=auth.uid()::text;
  IF me.id IS NULL THEN RAISE EXCEPTION 'Account is not linked to MyTeam' USING ERRCODE='28000'; END IF;
  SELECT * INTO membership FROM organisation_memberships
   WHERE person_id=me.id AND status='active' ORDER BY created_at LIMIT 1;
  IF membership.id IS NULL THEN RAISE EXCEPTION 'No active membership' USING ERRCODE='28000'; END IF;
  RETURN jsonb_build_object(
    'person',jsonb_build_object('id',me.id,'name',me.preferred_name,'roles',membership.roles),
    'people',CASE WHEN 'manager'=ANY(membership.roles) THEN
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',p.preferred_name) ORDER BY p.preferred_name),'[]'::jsonb)
       FROM people p JOIN organisation_memberships m ON m.person_id=p.id
       WHERE m.organisation_id=membership.organisation_id AND m.status='active' AND 'instructor'=ANY(m.roles))
       ELSE '[]'::jsonb END,
    'requests',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'id',r.id,'status',r.status,'ownerId',r.owner_id,'owner',o.preferred_name,
       'managerId',r.assigned_manager_id,'note',r.note,'urgent',r.urgent,'createdAt',r.created_at,
       'classes',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'time',c.starts_at,'label',c.label,
          'status',c.status,'sourceStatus',c.source_status,'assignedId',c.assigned_instructor_id,
          'assigned',(SELECT preferred_name FROM people WHERE id=c.assigned_instructor_id)) ORDER BY c.starts_at),'[]'::jsonb)
          FROM cover_classes c WHERE c.cover_request_id=r.id),
       'invitations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'classId',i.cover_class_id,
          'instructorId',i.instructor_id,'instructor',p.preferred_name,'status',i.status)),'[]'::jsonb)
          FROM cover_invitations i JOIN cover_classes c ON c.id=i.cover_class_id JOIN people p ON p.id=i.instructor_id
          WHERE c.cover_request_id=r.id AND ('manager'=ANY(membership.roles) OR i.instructor_id=me.id)),
       'applications',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'classId',a.cover_class_id,
          'instructorId',a.instructor_id,'instructor',p.preferred_name,'status',a.status)),'[]'::jsonb)
          FROM cover_applications a JOIN cover_classes c ON c.id=a.cover_class_id JOIN people p ON p.id=a.instructor_id
          WHERE c.cover_request_id=r.id AND ('manager'=ANY(membership.roles) OR a.instructor_id=me.id))
      ) ORDER BY r.created_at DESC),'[]'::jsonb)
      FROM cover_requests r LEFT JOIN people o ON o.id=r.owner_id
      WHERE r.organisation_id=membership.organisation_id AND
       (('manager'=ANY(membership.roles) AND r.assigned_manager_id=me.id) OR r.owner_id=me.id OR ('instructor'=ANY(membership.roles) AND r.status='open') OR
        EXISTS (SELECT 1 FROM cover_classes c WHERE c.cover_request_id=r.id AND
          (c.assigned_instructor_id=me.id OR EXISTS (SELECT 1 FROM cover_invitations i WHERE i.cover_class_id=c.id AND i.instructor_id=me.id) OR
           EXISTS (SELECT 1 FROM cover_applications a WHERE a.cover_class_id=c.id AND a.instructor_id=me.id)))))),
    'notifications',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'createdAt',n.created_at,'readAt',n.read_at)
      ORDER BY n.created_at DESC),'[]'::jsonb) FROM (SELECT * FROM cover_notifications WHERE person_id=me.id ORDER BY created_at DESC LIMIT 30) n)
  );
END $$;

CREATE OR REPLACE FUNCTION myteam_cover_action(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE me people%ROWTYPE; membership organisation_memberships%ROWTYPE;
  r cover_requests%ROWTYPE; c cover_classes%ROWTYPE; inv cover_invitations%ROWTYPE;
  app cover_applications%ROWTYPE; target uuid; action text := p->>'action'; entry jsonb;
  count_active integer; owner_manager uuid;
BEGIN
  SELECT * INTO me FROM people WHERE auth_subject=auth.uid()::text;
  SELECT * INTO membership FROM organisation_memberships WHERE person_id=me.id AND status='active' ORDER BY created_at LIMIT 1;
  IF me.id IS NULL OR membership.id IS NULL THEN RAISE EXCEPTION 'Unauthorised account' USING ERRCODE='28000'; END IF;
  IF action='post' THEN
    IF NOT 'instructor'=ANY(membership.roles) THEN RAISE EXCEPTION 'Instructor role required'; END IF;
    SELECT manager_id INTO owner_manager FROM owner_manager_assignments WHERE owner_id=me.id;
    IF owner_manager IS NULL OR NOT EXISTS(SELECT 1 FROM organisation_memberships m WHERE m.person_id=owner_manager AND m.organisation_id=membership.organisation_id AND m.status='active' AND 'manager'=ANY(m.roles)) OR jsonb_array_length(COALESCE(p->'classes','[]'::jsonb)) NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION 'Assigned manager and 1–3 classes required'; END IF;
    IF length(COALESCE(p->>'note',''))>1000 THEN RAISE EXCEPTION 'Note too long'; END IF;
    INSERT INTO cover_requests(organisation_id,owner_id,assigned_manager_id,status,urgent,note)
      VALUES(membership.organisation_id,me.id,owner_manager,'open',COALESCE((p->>'urgent')::boolean,false),p->>'note') RETURNING * INTO r;
    FOR entry IN SELECT * FROM jsonb_array_elements(p->'classes') LOOP
      IF (entry->>'time')::timestamptz <= now() THEN RAISE EXCEPTION 'Class must be in the future'; END IF;
      INSERT INTO cover_classes(cover_request_id,starts_at,label,status)
        VALUES(r.id,(entry->>'time')::timestamptz,left(entry->>'label',120),'open');
    END LOOP;
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      VALUES(owner_manager,r.id,'Cover request posted',COALESCE(me.preferred_name,'Instructor')||' needs cover. Review the request.');
    RETURN jsonb_build_object('requestId',r.id);
  END IF;

  IF action='read_notification' THEN
    UPDATE cover_notifications SET read_at=now() WHERE id=(p->>'notificationId')::uuid AND person_id=me.id;
    RETURN jsonb_build_object('ok',true);
  END IF;

  SELECT * INTO c FROM cover_classes WHERE id=(p->>'classId')::uuid FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
  SELECT * INTO r FROM cover_requests WHERE id=c.cover_request_id AND organisation_id=membership.organisation_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Class not in organisation'; END IF;
  IF action IN ('invite','approve','mark_source','reconcile_withdrawal') AND
     (r.assigned_manager_id<>me.id OR NOT 'manager'=ANY(membership.roles)) THEN RAISE EXCEPTION 'Assigned manager required'; END IF;
  IF action='invite' THEN
    IF r.status<>'open' OR c.status NOT IN ('open','reopened') THEN RAISE EXCEPTION 'Class no longer open'; END IF;
    target:=(p->>'instructorId')::uuid;
    IF target=r.owner_id OR NOT EXISTS(SELECT 1 FROM organisation_memberships m WHERE m.person_id=target AND m.organisation_id=r.organisation_id AND m.status='active' AND 'instructor'=ANY(m.roles)) OR
       EXISTS(SELECT 1 FROM external_schedule_entries e WHERE e.person_id=target AND e.revoked_at IS NULL AND e.starts_at<c.starts_at+interval '80 minutes' AND e.ends_at>c.starts_at-interval '30 minutes') THEN
      RAISE EXCEPTION 'Instructor is not eligible'; END IF;
    SELECT count(*) INTO count_active FROM cover_invitations WHERE cover_class_id=c.id AND status='requested';
    IF count_active>=2 THEN RAISE EXCEPTION 'Two invitations already active'; END IF;
    IF EXISTS(SELECT 1 FROM cover_invitations WHERE cover_class_id=c.id AND instructor_id=target) THEN
      RAISE EXCEPTION 'Instructor was already invited'; END IF;
    IF EXISTS(SELECT 1 FROM cover_applications WHERE cover_class_id=c.id AND instructor_id=target AND status='pending') THEN
      RAISE EXCEPTION 'Instructor already applied; review their application'; END IF;
    INSERT INTO cover_invitations(cover_class_id,instructor_id,status) VALUES(c.id,target,'requested');
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      VALUES(target,r.id,'Cover invitation',COALESCE(c.label,'Class')||' is waiting for your response.');
  ELSIF action='apply' THEN
    IF me.id=r.owner_id OR NOT 'instructor'=ANY(membership.roles) OR r.status<>'open' OR c.status NOT IN ('open','reopened') OR
      EXISTS(SELECT 1 FROM external_schedule_entries e WHERE e.person_id=me.id AND e.revoked_at IS NULL AND e.starts_at<c.starts_at+interval '80 minutes' AND e.ends_at>c.starts_at-interval '30 minutes') THEN RAISE EXCEPTION 'Class unavailable or conflicts with another shift'; END IF;
    IF EXISTS(SELECT 1 FROM cover_applications WHERE cover_class_id=c.id AND instructor_id=me.id) THEN RAISE EXCEPTION 'Application already recorded'; END IF;
    INSERT INTO cover_applications(cover_class_id,instructor_id,status) VALUES(c.id,me.id,'pending')
      ON CONFLICT (cover_class_id,instructor_id) DO NOTHING;
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      VALUES(r.assigned_manager_id,r.id,'Cover application',COALESCE(me.preferred_name,'Instructor')||' applied for '||COALESCE(c.label,'a class'));
  ELSIF action='respond' THEN
    SELECT * INTO inv FROM cover_invitations WHERE cover_class_id=c.id AND instructor_id=me.id AND status='requested' FOR UPDATE;
    IF inv.id IS NULL OR r.status<>'open' OR c.status NOT IN ('open','reopened') THEN RAISE EXCEPTION 'Invitation no longer active'; END IF;
    IF COALESCE((p->>'accept')::boolean,false) THEN
      UPDATE cover_invitations SET status='approved',answered_at=now() WHERE id=inv.id;
      UPDATE cover_invitations SET status='not_selected',answered_at=now() WHERE cover_class_id=c.id AND status='requested' AND id<>inv.id;
      UPDATE cover_applications SET status='not_selected',decided_at=now() WHERE cover_class_id=c.id AND status='pending';
      UPDATE cover_classes SET status='filled',assigned_instructor_id=me.id,source_status='pending' WHERE id=c.id;
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT instructor_id,r.id,'Cover filled','Another instructor accepted '||COALESCE(c.label,'this class') FROM cover_invitations WHERE cover_class_id=c.id AND status='not_selected';
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT instructor_id,r.id,'Application outcome','Another instructor accepted '||COALESCE(c.label,'this class') FROM cover_applications WHERE cover_class_id=c.id AND status='not_selected';
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT x,r.id,'Cover confirmed',COALESCE(me.preferred_name,'Instructor')||' accepted '||COALESCE(c.label,'the class')
        FROM (SELECT r.owner_id x UNION SELECT r.assigned_manager_id) q WHERE x IS NOT NULL;
    ELSE
      UPDATE cover_invitations SET status='declined',answered_at=now() WHERE id=inv.id;
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        VALUES(r.assigned_manager_id,r.id,'Cover declined',COALESCE(me.preferred_name,'Instructor')||' declined '||COALESCE(c.label,'the class'));
    END IF;
  ELSIF action='approve' THEN
    IF r.status<>'open' OR c.status NOT IN ('open','reopened') THEN RAISE EXCEPTION 'Class no longer open'; END IF;
    SELECT * INTO app FROM cover_applications WHERE cover_class_id=c.id AND instructor_id=(p->>'instructorId')::uuid AND status='pending' FOR UPDATE;
    IF app.id IS NULL THEN RAISE EXCEPTION 'Pending applicant required'; END IF;
    UPDATE cover_applications SET status='approved',decided_at=now() WHERE id=app.id;
    UPDATE cover_applications SET status='not_selected',decided_at=now() WHERE cover_class_id=c.id AND status='pending';
    UPDATE cover_invitations SET status='not_selected',answered_at=now() WHERE cover_class_id=c.id AND status='requested';
    UPDATE cover_classes SET status='filled',assigned_instructor_id=app.instructor_id,source_status='pending' WHERE id=c.id;
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      VALUES(app.instructor_id,r.id,'Cover approved','Management approved your application for '||COALESCE(c.label,'a class')),
      (r.owner_id,r.id,'Cover confirmed',COALESCE(c.label,'Class')||' has a replacement');
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      SELECT instructor_id,r.id,'Cover filled',COALESCE(c.label,'Class')||' was assigned to another instructor'
      FROM cover_invitations WHERE cover_class_id=c.id AND status='not_selected';
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      SELECT instructor_id,r.id,'Application outcome',COALESCE(c.label,'Class')||' was assigned to another instructor'
      FROM cover_applications WHERE cover_class_id=c.id AND status='not_selected';
  ELSIF action='withdraw' THEN
    IF me.id=r.owner_id THEN
      UPDATE cover_requests SET status='withdrawn',withdrawn_at=now() WHERE id=r.id;
      UPDATE cover_classes SET source_status=CASE WHEN assigned_instructor_id IS NULL THEN source_status ELSE 'mismatch' END WHERE cover_request_id=r.id;
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT DISTINCT assigned_instructor_id,r.id,'Cover cancellation pending','Original instructor withdrew. Follow the live Mariana Tek assignment until management confirms the change.'
        FROM cover_classes WHERE cover_request_id=r.id AND assigned_instructor_id IS NOT NULL;
      UPDATE cover_invitations SET status='withdrawn' WHERE cover_class_id IN (SELECT id FROM cover_classes WHERE cover_request_id=r.id) AND status='requested';
      UPDATE cover_applications SET status='withdrawn' WHERE cover_class_id IN (SELECT id FROM cover_classes WHERE cover_request_id=r.id) AND status='pending';
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT instructor_id,r.id,'Cover request withdrawn','The request was cancelled; your invitation is closed'
        FROM cover_invitations WHERE cover_class_id IN (SELECT id FROM cover_classes WHERE cover_request_id=r.id) AND status='withdrawn';
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        SELECT instructor_id,r.id,'Cover request withdrawn','The request was cancelled; your application is closed'
        FROM cover_applications WHERE cover_class_id IN (SELECT id FROM cover_classes WHERE cover_request_id=r.id) AND status='withdrawn';
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        VALUES(r.assigned_manager_id,r.id,'Cover withdrawn','Review and reconcile the live Mariana Tek assignment');
    ELSE
      IF c.assigned_instructor_id=me.id THEN
        UPDATE cover_classes SET assigned_instructor_id=NULL,status='reopened',source_status='mismatch' WHERE id=c.id;
        UPDATE cover_requests SET status='open' WHERE id=r.id AND status='filled';
        UPDATE cover_invitations SET status='withdrawn' WHERE cover_class_id=c.id AND instructor_id=me.id AND status='approved';
        UPDATE cover_applications SET status='withdrawn' WHERE cover_class_id=c.id AND instructor_id=me.id AND status='approved';
        INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
          SELECT r.owner_id,r.id,'Confirmed cover withdrawn',COALESCE(me.preferred_name,'Instructor')||' withdrew from '||COALESCE(c.label,'your class') WHERE r.owner_id IS NOT NULL;
      ELSE
        UPDATE cover_applications SET status='withdrawn' WHERE cover_class_id=c.id AND instructor_id=me.id AND status='pending';
      END IF;
      INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
        VALUES(r.assigned_manager_id,r.id,'Instructor withdrew cover',COALESCE(me.preferred_name,'Instructor')||' withdrew from '||COALESCE(c.label,'a class'));
    END IF;
  ELSIF action='mark_source' THEN
    UPDATE cover_classes SET source_status='verify_pending',source_marked_at=now(),verify_after=now()+interval '1 hour' WHERE id=c.id AND status='filled';
  ELSIF action='reconcile_withdrawal' THEN
    IF r.status<>'withdrawn' OR c.source_status<>'mismatch' THEN RAISE EXCEPTION 'No cancellation mismatch to review'; END IF;
    UPDATE cover_classes SET status='closed',source_status='verified',source_checked_at=now() WHERE id=c.id;
    INSERT INTO cover_notifications(person_id,cover_request_id,title,body)
      SELECT x,r.id,'Cancellation reconciled','Management confirmed the final Mariana Tek assignment'
      FROM (SELECT r.owner_id x UNION SELECT c.assigned_instructor_id) q WHERE x IS NOT NULL;
  ELSE RAISE EXCEPTION 'Unknown cover action';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM cover_classes WHERE cover_request_id=r.id AND status IN ('open','reopened')) AND r.status='open' THEN
    UPDATE cover_requests SET status='filled' WHERE id=r.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'requestId',r.id,'classId',c.id);
END $$;

REVOKE ALL ON FUNCTION myteam_cover_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION myteam_cover_action(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION myteam_cover_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION myteam_cover_action(jsonb) TO authenticated;
