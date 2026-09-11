from datetime import datetime, timezone


def create_audit_event(
    person_id,
    action,
    recorded_at_utc=None,
    details=None,
):
    if recorded_at_utc is None:
        recorded_at_utc = datetime.now(timezone.utc).isoformat()

    return {
        "person_id": person_id,
        "action": action,
        "recorded_at_utc": recorded_at_utc,
        "details": details or {},
    }


def export_user_data(
    rows,
    consent_records,
    person_id,
):
    user_rows = [
        row
        for row in rows
        if row.get("person_id") == person_id
    ]

    user_consent_records = [
        record
        for record in consent_records
        if record.get("person_id") == person_id
    ]

    return {
        "person_id": person_id,
        "signals": user_rows,
        "consent_records": user_consent_records,
    }


def delete_user_data(
    rows,
    consent_records,
    audit_log,
    person_id,
    recorded_at_utc=None,
):
    deleted_signal_count = sum(
        1
        for row in rows
        if row.get("person_id") == person_id
    )

    deleted_consent_count = sum(
        1
        for record in consent_records
        if record.get("person_id") == person_id
    )

    remaining_rows = [
        row
        for row in rows
        if row.get("person_id") != person_id
    ]

    remaining_consent_records = [
        record
        for record in consent_records
        if record.get("person_id") != person_id
    ]

    deletion_event = create_audit_event(
        person_id=person_id,
        action="user_data_deleted",
        recorded_at_utc=recorded_at_utc,
        details={
            "deleted_signal_count": deleted_signal_count,
            "deleted_consent_count": deleted_consent_count,
        },
    )

    updated_audit_log = list(audit_log)
    updated_audit_log.append(deletion_event)

    return {
        "rows": remaining_rows,
        "consent_records": remaining_consent_records,
        "audit_log": updated_audit_log,
    }