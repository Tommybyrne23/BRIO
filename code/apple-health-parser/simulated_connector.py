from csv_importer import parse_csv, build_daily_signal_row


SIMULATED_SOURCE_NAME = "simulated"
SIMULATED_SOURCE_LABEL = "Simulated"


def parse_simulated_csv(csv_path):
    for raw_row in parse_csv(csv_path, simulated=True):
        yield raw_row


def build_simulated_daily_signal(csv_row):
    row = build_daily_signal_row(csv_row, simulated=True)

    if row is None:
        return None

    # These values are intentionally fixed.
    # Simulated data must never appear as a real external source.
    row["source_name"] = SIMULATED_SOURCE_NAME
    row["source_label"] = SIMULATED_SOURCE_LABEL
    row["is_simulated"] = True

    return row