import os
import requests
from bs4 import BeautifulSoup
import time
from PIL import Image

# URL of the webpage to scrape
url = "https://nerevarine-prophecies.fandom.com/wiki/Server_Items"

# Create a directory to save the images
os.makedirs('images', exist_ok=True)

# Function to download an image and resize it while maintaining the aspect ratio
def download_and_resize_image(image_url, image_name):
    image_path = os.path.join('images', sanitize_filename(image_name + '.png'))  # Save as .png
    try:
        response = requests.get(image_url, stream=True, timeout=10)
        if response.status_code == 200:
            with open('temp.png', 'wb') as file:
                file.write(response.content)
            img = Image.open('temp.png')

            # Get the original dimensions
            original_width, original_height = img.size
            # Calculate the new dimensions (3x larger)
            new_dimensions = (original_width * 3, original_height * 3)

            # Resize the image
            img = img.resize(new_dimensions, Image.LANCZOS)
            img.save(image_path)
            print(f"Downloaded and resized {image_path}")
        else:
            print(f"Failed to download {image_url}")
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        print(f"Error downloading {image_url}: {e}")
        print("Retrying in 5 seconds...")
        time.sleep(5)
        download_and_resize_image(image_url, image_name)
    finally:
        if os.path.exists('temp.png'):
            img.close()  # Close the image file
            os.remove('temp.png')

# Function to sanitize the filename
def sanitize_filename(filename):
    invalid_chars = '<>:"/\\|?*'
    sanitized = ''.join(c for c in filename if c not in invalid_chars)
    return sanitized

# Fetch the webpage
response = requests.get(url)
if response.status_code == 200:
    soup = BeautifulSoup(response.content, 'html.parser')

    # Find the table containing the items
    table = soup.find('table', {'class': 'wikitable'})

    if table:
        # Iterate through each row of the table
        for row in table.find_all('tr')[1:]:  # Skip the header row
            cells = row.find_all('td')
            if len(cells) > 1:  # Ensure there are enough cells
                # Find all image tags in the second column (index 1)
                image_tags = cells[1].find_all('img')
                for image_tag in image_tags:
                    image_url = image_tag.get('src')  # Use 'src' attribute directly
                    image_name = cells[0].text.strip()  # Use item name from the first column
                    if image_url and image_name and not image_url.startswith('data:image'):
                        download_and_resize_image(image_url, image_name)
    else:
        print("Could not find the table on the webpage.")
else:
    print(f"Failed to fetch the webpage: {response.status_code}")
