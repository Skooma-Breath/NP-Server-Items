from bs4 import BeautifulSoup
import json

# Load the HTML content
with open('Server Items _ Nerevarine Prophecies Wiki _ Fandom.html', 'r', encoding='utf-8') as file:
    content = file.read()

# Parse the HTML content
soup = BeautifulSoup(content, 'html.parser')

# Find the table (assuming there's only one main table for items)
table = soup.find('table')

# Extract table headers
headers = [header.text.strip() for header in table.find_all('th')]

# Extract table rows
rows = []
for row in table.find_all('tr')[1:]:  # Skip the header row
    cells = row.find_all('td')
    if len(cells) == len(headers):
        row_data = {headers[i]: cells[i].text.strip() for i in range(len(headers))}
        rows.append(row_data)

# Convert to JSON
json_data = json.dumps(rows, ensure_ascii=False, indent=4)

# Save to a JSON file
with open('items_data.json', 'w', encoding='utf-8') as json_file:
    json_file.write(json_data)

print('Data has been extracted to items_data.json')
