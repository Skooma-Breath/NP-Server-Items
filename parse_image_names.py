import os
import re

def clean_and_deduplicate_filenames(directory):
    filenames = os.listdir(directory)

    # Create a dictionary to track filenames and their counts
    filename_counts = {}

    for filename in filenames:
        # Check if the file is an image
        if filename.endswith('.jpg'):
            # Extract the base name without the extension
            base_name = os.path.splitext(filename)[0]

            # Remove "no trade" from the filename
            base_name = base_name.replace("no trade", "")

            # Remove 1 or 2 characters followed by a space at the beginning of the filename
            base_name = re.sub(r'^\S{1,2}\s', '', base_name)

            # Remove all non-letter characters except apostrophes and replace underscores with spaces
            clean_name = re.sub(r'[^a-zA-Z\' ]+', '', base_name.replace('_', ' '))

            # Remove any trailing spaces
            clean_name = re.sub(r'\s+$', '', clean_name)

            # Deduplicate filenames
            if clean_name not in filename_counts:
                filename_counts[clean_name] = 1
            else:
                filename_counts[clean_name] += 1
                clean_name += f'_{filename_counts[clean_name]}'
            
            # Construct the new filename with .png extension
            new_filename = clean_name + '.png'

            # Get the full paths
            old_file_path = os.path.join(directory, filename)
            new_file_path = os.path.join(directory, new_filename)

            # Rename the file
            os.rename(old_file_path, new_file_path)

            print(f'Renamed: {old_file_path} -> {new_file_path}')

# Example usage: Call clean_and_deduplicate_filenames with the 'processed_images' directory
clean_and_deduplicate_filenames('processed_images')
