import unittest

from data_usage_notice import (
    NOTICE_VERSION,
    get_data_usage_notice,
    record_acknowledgement,
    can_continue_onboarding,
    exit_onboarding,
)


class TestDataUsageNotice(unittest.TestCase):

    def test_notice_explains_non_clinical_daily_suggestion(self):
        notice = get_data_usage_notice()

        self.assertEqual(
            notice["purpose"],
            "non_clinical_daily_suggestion",
        )

        self.assertIn(
            "current check-in data",
            notice["text"],
        )

        self.assertIn(
            "non-clinical daily suggestion",
            notice["text"],
        )

    def test_affirmative_acknowledgement_records_version_and_timestamp(self):
        acknowledgement = record_acknowledgement(
            person_id="P001",
            affirmative=True,
            acknowledged_at_utc="2026-09-11T00:30:00+00:00",
        )

        self.assertTrue(
            acknowledgement["affirmative"]
        )

        self.assertEqual(
            acknowledgement["notice_version"],
            NOTICE_VERSION,
        )

        self.assertEqual(
            acknowledgement["acknowledged_at_utc"],
            "2026-09-11T00:30:00+00:00",
        )

        self.assertTrue(
            can_continue_onboarding(
                acknowledgement
            )
        )

    def test_non_affirmative_acknowledgement_cannot_continue(self):
        with self.assertRaises(ValueError):
            record_acknowledgement(
                person_id="P001",
                affirmative=False,
            )

    def test_exit_onboarding_submits_no_personal_inputs(self):
        result = exit_onboarding(
            person_id="P001"
        )

        self.assertEqual(
            result["status"],
            "exited",
        )

        self.assertIsNone(
            result["acknowledgement"]
        )

        self.assertEqual(
            result["submitted_inputs"],
            [],
        )

    def test_missing_acknowledgement_cannot_continue(self):
        self.assertFalse(
            can_continue_onboarding(None)
        )


if __name__ == "__main__":
    unittest.main()