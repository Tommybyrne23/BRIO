import unittest

from consent import (
    CONSENT_GRANTED,
    CONSENT_REVOKED,
    create_consent_record,
    is_source_allowed,
    filter_rows_by_consent,
)

from readiness import assess_readiness


class TestConsent(unittest.TestCase):

    def test_granted_source_is_allowed(self):
        consent_records = [
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_GRANTED,
                recorded_at_utc="2026-09-10T08:00:00+00:00",
            )
        ]

        allowed = is_source_allowed(
            consent_records=consent_records,
            person_id="P001",
            signal_type="hrv_sdnn",
            source_name="whoop",
        )

        self.assertTrue(allowed)

    def test_revoked_source_is_blocked(self):
        consent_records = [
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_GRANTED,
                recorded_at_utc="2026-09-10T08:00:00+00:00",
            ),
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_REVOKED,
                recorded_at_utc="2026-09-10T09:00:00+00:00",
            ),
        ]

        allowed = is_source_allowed(
            consent_records=consent_records,
            person_id="P001",
            signal_type="hrv_sdnn",
            source_name="whoop",
        )

        self.assertFalse(allowed)

    def test_consent_is_per_signal_type(self):
        consent_records = [
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_REVOKED,
                recorded_at_utc="2026-09-10T09:00:00+00:00",
            ),
            create_consent_record(
                person_id="P001",
                signal_type="resting_heart_rate",
                source_name="whoop",
                status=CONSENT_GRANTED,
                recorded_at_utc="2026-09-10T09:00:00+00:00",
            ),
        ]

        hrv_allowed = is_source_allowed(
            consent_records=consent_records,
            person_id="P001",
            signal_type="hrv_sdnn",
            source_name="whoop",
        )

        rhr_allowed = is_source_allowed(
            consent_records=consent_records,
            person_id="P001",
            signal_type="resting_heart_rate",
            source_name="whoop",
        )

        self.assertFalse(hrv_allowed)
        self.assertTrue(rhr_allowed)

    def test_revoked_source_stops_influencing_readiness_immediately(self):
        history_rows = [
            {
                "person_id": "P001",
                "local_date": "2026-09-03",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-04",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-05",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-06",
                "signal_type": "hrv_sdnn",
                "value": 60,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-07",
                "signal_type": "hrv_sdnn",
                "value": 63,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-08",
                "signal_type": "hrv_sdnn",
                "value": 61,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
            {
                "person_id": "P001",
                "local_date": "2026-09-09",
                "signal_type": "hrv_sdnn",
                "value": 62,
                "device_key": "whoop",
                "source_name": "whoop",
                "coverage_status": "complete",
                "freshness_status": "fresh",
            },
        ]

        today_row = {
            "person_id": "P001",
            "local_date": "2026-09-10",
            "signal_type": "hrv_sdnn",
            "value": 50,
            "device_key": "whoop",
            "source_name": "whoop",
            "coverage_status": "complete",
            "freshness_status": "fresh",
        }

        consent_records = [
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_GRANTED,
                recorded_at_utc="2026-09-10T08:00:00+00:00",
            )
        ]

        allowed_history = filter_rows_by_consent(
            history_rows,
            consent_records,
        )

        allowed_today = filter_rows_by_consent(
            [today_row],
            consent_records,
        )

        result = assess_readiness(
            rows=allowed_history,
            today_row=allowed_today[0],
        )

        self.assertEqual(result["movement_status"], "moved_down")

        # The user now revokes WHOOP access for HRV.
        consent_records.append(
            create_consent_record(
                person_id="P001",
                signal_type="hrv_sdnn",
                source_name="whoop",
                status=CONSENT_REVOKED,
                recorded_at_utc="2026-09-10T09:00:00+00:00",
            )
        )

        allowed_history_after_revoke = filter_rows_by_consent(
            history_rows,
            consent_records,
        )

        allowed_today_after_revoke = filter_rows_by_consent(
            [today_row],
            consent_records,
        )

        self.assertEqual(allowed_history_after_revoke, [])
        self.assertEqual(allowed_today_after_revoke, [])

        
if __name__ == "__main__":
    unittest.main()