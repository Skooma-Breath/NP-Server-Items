import os
import pytesseract
from PIL import Image

# Path to the images folder
images_folder = "images"

# Path to save the JSON file
output_json_file = "output.json"

# Dictionary to store image names and their OCR results
ocr_results = {}

# Iterate over each image in the folder
for image_file in os.listdir(images_folder):
    # Check if the file is an image
    if image_file.endswith(".png") or image_file.endswith(".jpg") or image_file.endswith(".jpeg"):
        # Construct the full path to the image file
        image_path = os.path.join(images_folder, image_file)

        # Use PIL to open the image
        with Image.open(image_path) as img:
            # Use pytesseract to perform OCR on the image
            ocr_text = pytesseract.image_to_string(img)

        # Add the OCR result to the dictionary
        ocr_results[image_file] = ocr_text

# Save the OCR results as a JSON file
import json
with open(output_json_file, "w") as json_file:
    json.dump(ocr_results, json_file)

print("OCR results saved to", output_json_file)
