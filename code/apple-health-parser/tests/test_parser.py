import unittest

from parser import (
    parse_apple_health,
    parse_healthkit_datetime,
    normalize_workout_duration,
    is_duplicate_workout,
    deduplicate_workouts,
)


class TestAppleHealthParser(unittest.TestCase):

    def setUp(self):
        self.rows = list(
            parse_apple_health(
                "tests/fixtures/sample_export.xml",
                "P001"
            )
        )

    def test_fixture_parses_five_rows(self):
        self.assertEqual(len(self.rows), 5)

    def test_required_signal_types_are_parsed(self):
        signal_types = {
            row["signal_type"]
            for row in self.rows
        }

        self.assertIn("resting_heart_rate", signal_types)
        self.assertIn("hrv_sdnn", signal_types)
        self.assertIn("sleep", signal_types)
        self.assertIn("workout", signal_types)

    def test_healthkit_time_conversion(self):
        utc_time, offset = parse_healthkit_datetime(
            "2026-09-08 08:58:00 +0100"
        )

        self.assertEqual(
            utc_time,
            "2026-09-08T07:58:00+00:00"
        )
        self.assertEqual(offset, "+0100")

    def test_workout_duration_normalization(self):
        self.assertEqual(
            normalize_workout_duration("1800", "sec"),
            30.0
        )

        self.assertEqual(
            normalize_workout_duration("0.5", "hr"),
            30.0
        )

        self.assertEqual(
            normalize_workout_duration("30", "min"),
            30.0
        )

    def test_duplicate_workouts_are_detected(self):
        workouts = [
            row for row in self.rows
            if row["signal_type"] == "workout"
        ]

        self.assertEqual(len(workouts), 2)

        self.assertTrue(
            is_duplicate_workout(
                workouts[0],
                workouts[1]
            )
        )

    def test_whoop_is_preferred_during_dedupe(self):
        workouts = [
            row for row in self.rows
            if row["signal_type"] == "workout"
        ]

        selected = deduplicate_workouts(workouts)

        self.assertEqual(len(selected), 1)
        self.assertEqual(
            selected[0]["source_name"],
            "WHOOP"
        )
    def test_source_version_is_preserved(self):
        rhr_rows = [
            row for row in self.rows
            if row["signal_type"] == "resting_heart_rate"
        ]

        self.assertEqual(
            rhr_rows[0]["source_version"],
            "526415"
        )

if __name__ == "__main__":
    unittest.main()