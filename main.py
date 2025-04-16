import pandas as pd
import logging
import argparse
from config import BATCH_SIZE
from classifiers import classify_ethnicity_rules, classify_batch_ai

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
        logging.info(f"Successfully loaded CSV from: {filepath}")
        return df
    except FileNotFoundError:
        logging.error(f"Error: File not found at {filepath}")
        return None
    except pd.errors.EmptyDataError:
        logging.error(f"Error: No data found in file {filepath}")
        return None
    except Exception as e:
        logging.error(
            f"An unexpected error occurred while loading {filepath}: {e}"
        )
        return None

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
        logging.info(f"Successfully saved DataFrame to: {filepath}")
    except Exception as e:
        logging.error(
            f"An unexpected error occurred while saving to {filepath}: {e}"
        )

def main(input_file, output_file):
    logging.info(f"Starting classification process for {input_file}")

    df = load_csv(input_file)
    if df is None:
        return # Exit if loading failed

    if 'fullName' not in df.columns:
        logging.error(f"'fullName' column not found in {input_file}")
        return

    # --- Phase 2: Apply Rule-Based Classifier ---
    logging.info("Applying rule-based classification...")
    # Apply rule-based classification
    # Pass only the name, as classify_ethnicity_rules uses the imported surname list internally
    df['ethnicity'] = df['fullName'].apply(lambda name: classify_ethnicity_rules(name))
    logging.info("Rule-based classification complete.")
    logging.info(f"Results distribution after rules:\n{df['ethnicity'].value_counts()}")

    # --- Phase 3: AI Classification for Uncertain Cases ---
    uncertain_mask = df['ethnicity'] == 'Uncertain'
    uncertain_indices = df.index[uncertain_mask]
    uncertain_names = df.loc[uncertain_mask, 'fullName'].tolist()

    if not uncertain_names:
        logging.info("No names marked as 'Uncertain'. Skipping AI classification.")
    else:
        logging.info(f"Found {len(uncertain_names)} names marked as 'Uncertain'. Starting AI classification in batches of {BATCH_SIZE}...")

        ai_results = []
        for i in range(0, len(uncertain_names), BATCH_SIZE):
            batch_names = uncertain_names[i:i + BATCH_SIZE]
            logging.info(f"Processing AI batch {i // BATCH_SIZE + 1} ({len(batch_names)} names)")
            batch_results = classify_batch_ai(batch_names)
            ai_results.extend(batch_results)

            # --- Frequent Save Logic (Phase 4) ---
            # Update the portion of the DataFrame processed in this batch
            if len(batch_results) == len(batch_names):
                current_indices = uncertain_indices[i:i + len(batch_names)]
                df.loc[current_indices, 'ethnicity'] = batch_results
                logging.debug(f"Updated DataFrame for batch {i // BATCH_SIZE + 1}. Saving intermediate results.")
                save_csv(df, output_file) # Save after each batch
            else:
                logging.warning(f"AI results length mismatch for batch {i // BATCH_SIZE + 1}. Expected {len(batch_names)}, got {len(batch_results)}. Skipping update and save for this batch.")

        # --- Final Verification & Logging (Optional but good practice) ---
        final_ai_processed_count = len(ai_results)
        if final_ai_processed_count == len(uncertain_indices):
            # Final check: Ensure all uncertain indices were intended to be updated (even if some batches failed individually and weren't updated)
            logging.info(f"AI classification phase complete. Processed {final_ai_processed_count} uncertain names.")
            logging.info(f"Final results distribution after AI classification:\n{df['ethnicity'].value_counts()}")
        else:
            # Log error if the total counts don't match after the loop
            logging.error(f"Mismatch between total expected AI results ({len(uncertain_indices)}) and total results received ({final_ai_processed_count}) across all batches. Final output might be incomplete.")

        # --- Save Final Results (Redundant if saving after every batch, but safe) ---
        logging.info(f"Ensuring final results are saved to {output_file}")
        save_csv(df, output_file)
        logging.info("Classification process finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify Malaysian names by ethnicity.")
    parser.add_argument("-i", "--input", required=True, help="Path to the input CSV file.")
    parser.add_argument("-o", "--output", required=True, help="Path to the output CSV file.")
    args = parser.parse_args()

    main(args.input, args.output)
