import pandas as pd
import logging
import argparse
from config import BATCH_SIZE, MIN_CONFIDENCE_THRESHOLD
from classifiers import classify_ethnicity_rules, classify_ethnicity_rules_with_confidence, classify_batch_ai
from column_detector import detect_name_column

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

def main(input_file, output_file, manual_column=None):
    logging.info(f"Starting classification process for {input_file}")

    df = load_csv(input_file)
    if df is None:
        return # Exit if loading failed

    # --- Phase 1: Intelligent Column Detection ---
    try:
        detection_result = detect_name_column(df, manual_column)
        name_column = detection_result.detected_column
        logging.info(f"Phase 1: Detected name column '{name_column}' (confidence: {detection_result.confidence_score:.2f})")
        logging.info(f"Detection reasoning: {detection_result.reasoning}")
    except Exception as e:
        logging.error(f"Failed to detect name column: {e}")
        return

    # --- Phase 2: Rule-Based Classification (Malaysian + Extended Countries) ---
    logging.info("Phase 2: Applying rule-based classification with confidence scoring...")
    
    # Add confidence column
    df['confidence'] = 0.0
    
    # Apply rule-based classification with confidence
    for idx, row in df.iterrows():
        name = row[name_column]
        ethnicity, confidence = classify_ethnicity_rules_with_confidence(name)
        df.loc[idx, 'ethnicity'] = ethnicity
        df.loc[idx, 'confidence'] = confidence
    
    logging.info("Phase 2 complete.")
    logging.info(f"Results distribution after rule-based classification:\n{df['ethnicity'].value_counts()}")
    logging.info(f"Average confidence: {df['confidence'].mean():.2f}")
    logging.info(f"High confidence (≥0.8): {(df['confidence'] >= 0.8).sum()}")
    logging.info(f"Medium confidence (0.6-0.8): {((df['confidence'] >= 0.6) & (df['confidence'] < 0.8)).sum()}")
    logging.info(f"Low confidence (<0.6): {(df['confidence'] < 0.6).sum()}")

    # --- Phase 3: AI Classification for Uncertain/Low-Confidence Cases ---
    uncertain_or_low_conf_mask = (df['ethnicity'] == 'Uncertain') | (df['confidence'] < MIN_CONFIDENCE_THRESHOLD)
    uncertain_indices = df.index[uncertain_or_low_conf_mask]
    uncertain_names = df.loc[uncertain_or_low_conf_mask, name_column].tolist()

    if not uncertain_names:
        logging.info("No names marked as 'Uncertain' or low confidence. Skipping AI classification.")
    else:
        logging.info(f"Phase 3: Found {len(uncertain_names)} names marked as 'Uncertain' or low confidence. Starting AI classification in batches of {BATCH_SIZE}...")

        for i in range(0, len(uncertain_names), BATCH_SIZE):
            batch_names = uncertain_names[i:i + BATCH_SIZE]
            logging.info(f"Processing AI batch {i // BATCH_SIZE + 1} ({len(batch_names)} names)")
            batch_results = classify_batch_ai(batch_names)

            # Update the portion of the DataFrame processed in this batch
            if len(batch_results) == len(batch_names):
                current_indices = uncertain_indices[i:i + len(batch_names)]
                for j, (ethnicity, confidence) in enumerate(batch_results):
                    idx = current_indices[j]
                    df.loc[idx, 'ethnicity'] = ethnicity
                    df.loc[idx, 'confidence'] = confidence
                
                logging.info(f"Updated DataFrame for batch {i // BATCH_SIZE + 1}. Saving intermediate results.")
                save_csv(df, output_file)
            else:
                logging.warning(f"AI results length mismatch for batch {i // BATCH_SIZE + 1}. Expected {len(batch_names)}, got {len(batch_results)}. Skipping update for this batch.")

        logging.info("Phase 3 complete.")
        logging.info(f"Final results distribution after AI classification:\n{df['ethnicity'].value_counts()}")

    # --- Final Statistics ---
    logging.info("Classification complete:")
    logging.info(f"  High confidence (≥0.8): {(df['confidence'] >= 0.8).sum()}")
    logging.info(f"  Medium confidence (0.6-0.8): {((df['confidence'] >= 0.6) & (df['confidence'] < 0.8)).sum()}")
    logging.info(f"  Low confidence (<0.6): {(df['confidence'] < 0.6).sum()}")
    logging.info(f"  Average confidence: {df['confidence'].mean():.3f}")

    # --- Save Final Results ---
    logging.info(f"Ensuring final results are saved to {output_file}")
    save_csv(df, output_file)
    
    # --- Save Final Results (always save, regardless of AI processing) ---
    logging.info(f"Saving final results to {output_file}")
    save_csv(df, output_file)
    logging.info("Classification process finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify Malaysian names by ethnicity.")
    parser.add_argument("-i", "--input", required=True, help="Path to the input CSV file.")
    parser.add_argument("-o", "--output", required=True, help="Path to the output CSV file.")
    parser.add_argument("-c", "--column", help="Manually specify the name column (overrides automatic detection).")
    args = parser.parse_args()

    main(args.input, args.output, args.column)
