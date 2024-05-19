import os
import requests
from PIL import Image
import pytesseract

# Function to process images
def process_images(image_urls_file):
    # Read image URLs from the file
    with open(image_urls_file, 'r') as f:
        image_urls = f.read().splitlines()

    # Create a directory to store processed images
    if not os.path.exists('processed_images'):
        os.makedirs('processed_images')

    # Loop through each image URL
    for idx, image_url in enumerate(image_urls):
        try:
            # Download the image
            image_data = requests.get(image_url).content

            # Save the image temporarily
            with open('temp_image.jpg', 'wb') as temp_file:
                temp_file.write(image_data)

            # Perform OCR on the image
            image_text = pytesseract.image_to_string(Image.open('temp_image.jpg')).strip().split('\n')[0]

            # Rename the image file
            new_filename = 'processed_images/{}_{}.jpg'.format(image_text.replace(" ", "_").replace("/", "_").replace("\\", "_"), idx)

            os.rename('temp_image.jpg', new_filename)

            print(f'Processed image {idx + 1}/{len(image_urls)}: {new_filename}')
        except Exception as e:
            print(f'Error processing image {idx + 1}: {e}')

# Example usage: Call process_images with the name of the text file containing image URLs
process_images('discord_server-items_images_420.txt')
