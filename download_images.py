import os
import requests
from bs4 import BeautifulSoup
import time
from PIL import Image

# URL of the webpage to scrape
url = "https://nerevarine-prophecies.fandom.com/wiki/Server_Items"

# Create a directory to save the images
os.makedirs('images', exist_ok=True)

def download_img(url, target_path):
    while True:
        try:
            response = requests.get(url, stream=True, timeout=10)
            response.raise_for_status()
            with open(target_path, 'wb') as file:
                file.write(response.content)
            return
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            print(f"Error downloading {image_url}: {e}")
            print("Retrying in 5 seconds...")
            time.sleep(5)

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
                image_links = cells[1].find_all('a', {'class': 'image'})
                for image_tag in image_links:
                    image_url = image_tag.get('href')  # Use 'src' attribute directly
                    image_name = cells[0].text.strip()  # Use item name from the first column
                    if image_url and image_name and not image_url.startswith('data:image'):
                        image_path = os.path.join('images', sanitize_filename(image_name + '.png'))
                        print(f"Saving {image_url} to {image_path}")
                        download_img(image_url, image_path)
    else:
        print("Could not find the table on the webpage.")
else:
    print(f"Failed to fetch the webpage: {response.status_code}")
