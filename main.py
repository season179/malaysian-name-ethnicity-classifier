import pandas as pd
import sys  # To exit if file loading fails
from classifiers import classify_ethnicity_rules

def load_csv(filepath: str) -> pd.DataFrame | None:
    """
    Loads data from a CSV file into a pandas DataFrame.

    Args:
        filepath: The path to the CSV file.

    Returns:
        A pandas DataFrame containing the data, or None if loading fails.
    """
    try:
        df = pd.read_csv(filepath)
        print(f"Successfully loaded CSV from: {filepath}")
        return df
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}", file=sys.stderr)
        sys.exit(1)  # Exit script if input file is not found
    except pd.errors.EmptyDataError:
        print(f"Error: No data found in file {filepath}", file=sys.stderr)
        sys.exit(1)  # Exit script if input file is empty
    except Exception as e:
        print(
            f"An unexpected error occurred while loading {filepath}: {e}",
            file=sys.stderr,
        )
        sys.exit(1)  # Exit on other potential loading errors


def save_csv(dataframe: pd.DataFrame, filepath: str):
    """
    Saves a pandas DataFrame to a CSV file.

    Args:
        dataframe: The pandas DataFrame to save.
        filepath: The path where the CSV file will be saved.
    """
    try:
        # Ensure output directory exists (optional, but good practice)
        # import os
        # os.makedirs(os.path.dirname(filepath), exist_ok=True)

        dataframe.to_csv(filepath, index=False)
        print(f"Successfully saved DataFrame to: {filepath}")
    except Exception as e:
        print(
            f"An unexpected error occurred while saving to {filepath}: {e}",
            file=sys.stderr,
        )
        # Depending on criticality, you might want to exit here too
        # sys.exit(1)


# --- Placeholder for main script logic ---
if __name__ == "__main__":
    # Define input and output file paths
    INPUT_FILE = "example-source-file.csv"  # Using the provided example
    OUTPUT_FILE = "output/rule_based_output.csv"  # Define an output file path

    print("Starting script execution...")
    print(f"Input file: {INPUT_FILE}")
    print(f"Output file: {OUTPUT_FILE}")

    df = load_csv(INPUT_FILE)

    if df is not None:
        # --- Apply Rule-Based Classifier --- #
        print("Applying rule-based ethnicity classifier...")
        # Check if 'fullName' column exists
        if 'fullName' not in df.columns:
            print(f"Error: 'fullName' column not found in {INPUT_FILE}", file=sys.stderr)
            sys.exit(1)

        # Apply the classification function to the 'fullName' column
        # Handle potential NaN values in fullName by filling with an empty string first
        df['ethnicity'] = df['fullName'].fillna('').astype(str).apply(classify_ethnicity_rules)
        print("Classification complete.")
        # --- End Classification --- #

        save_csv(df, OUTPUT_FILE)

    print("Script execution finished.")
