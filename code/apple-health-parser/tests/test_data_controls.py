import unittest

from data_controls import (
    export_user_data,
    delete_user_data,
)


class TestDataControls(unittest.TestCase):

    def test_export_returns_only_the_users_own_data(self):
        rows = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "value": 60,
            },
            {
                "person_id": "P002",
                "signal_type": "hrv_sdnn",
                "value": 70,
            },
        ]

        consent_records = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "source_name": "whoop",
                "status": "granted",
            },
            {
                "person_id": "P002",
                "signal_type": "hrv_sdnn",
                "source_name": "whoop",
                "status": "granted",
            },
        ]

        exported = export_user_data(
            rows=rows,
            consent_records=consent_records,
            person_id="P001",
        )

        self.assertEqual(exported["person_id"], "P001")
        self.assertEqual(len(exported["signals"]), 1)
        self.assertEqual(
            exported["signals"][0]["person_id"],
            "P001",
        )
        self.assertEqual(
            len(exported["consent_records"]),
            1,
        )
        self.assertEqual(
            exported["consent_records"][0]["person_id"],
            "P001",
        )

    def test_delete_removes_only_the_target_users_data(self):
        rows = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "value": 60,
            },
            {
                "person_id": "P002",
                "signal_type": "hrv_sdnn",
                "value": 70,
            },
        ]

        consent_records = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "source_name": "whoop",
                "status": "granted",
            },
            {
                "person_id": "P002",
                "signal_type": "hrv_sdnn",
                "source_name": "whoop",
                "status": "granted",
            },
        ]

        result = delete_user_data(
            rows=rows,
            consent_records=consent_records,
            audit_log=[],
            person_id="P001",
            recorded_at_utc="2026-09-11T00:00:00+00:00",
        )

        self.assertEqual(len(result["rows"]), 1)
        self.assertEqual(
            result["rows"][0]["person_id"],
            "P002",
        )

        self.assertEqual(
            len(result["consent_records"]),
            1,
        )
        self.assertEqual(
            result["consent_records"][0]["person_id"],
            "P002",
        )

    def test_delete_creates_audit_event(self):
        rows = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "value": 60,
            }
        ]

        consent_records = [
            {
                "person_id": "P001",
                "signal_type": "hrv_sdnn",
                "source_name": "whoop",
                "status": "granted",
            }
        ]

        result = delete_user_data(
            rows=rows,
            consent_records=consent_records,
            audit_log=[],
            person_id="P001",
            recorded_at_utc="2026-09-11T00:00:00+00:00",
        )

        self.assertEqual(len(result["audit_log"]), 1)

        event = result["audit_log"][0]

        self.assertEqual(
            event["action"],
            "user_data_deleted",
        )
        self.assertEqual(
            event["person_id"],
            "P001",
        )
        self.assertEqual(
            event["details"]["deleted_signal_count"],
            1,
        )
        self.assertEqual(
            event["details"]["deleted_consent_count"],
            1,
        )


if __name__ == "__main__":
    unittest.main()