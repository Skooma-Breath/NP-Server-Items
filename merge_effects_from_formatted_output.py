import json
from difflib import get_close_matches

# Load the renamed output data (renamed_output.json) with utf-8 encoding
with open('renamed_output.json', 'r', encoding='utf-8') as f:
    renamed_output = json.load(f)

# Load the items data (items_data.json) with utf-8 encoding
with open('items_data.json', 'r', encoding='utf-8') as f:
    items_data_list = json.load(f)

# Convert items_data_list to a dictionary with item names as keys
items_data = {item['Item Name']: item for item in items_data_list}

# Function to find the closest match for an item name
def find_closest_match(item_name, item_list):
    # Check for exact match first
    if item_name in item_list:
        return item_name
    # If exact match not found, find closest match
    matches = get_close_matches(item_name, item_list, n=1, cutoff=0.6)
    return matches[0] if matches else None

# Update items_data.json with "Stats" data from renamed_output.json
# Update items_data.json with "Stats" data from renamed_output.json
for item_name, item_data in renamed_output.items():
    print(f"Processing item: {item_name}")
    closest_match = find_closest_match(item_name, items_data.keys())
    print(f"Closest match: {closest_match}")
    if closest_match:
        # Check if "Stats" already exists in items_data
        if 'Stats' not in items_data[closest_match]:
            items_data[closest_match]['Stats'] = {}  # Create "Stats" table if it doesn't exist
            print(f"Before update: {items_data[closest_match]}")
            items_data[closest_match]['Stats'] = item_data.get('Stats', {})
            print(f"After update: {items_data[closest_match]}")
        else:
            print(f"'Stats' table already exists for '{closest_match}'. Skipping update.")
    else:
        print(f"No matching item found for '{item_name}' in items_data.json")


# Save the updated data to items_data.json
with open('items_data.json', 'w', encoding='utf-8') as f:
    json.dump(list(items_data.values()), f, indent=4, ensure_ascii=False)

print("Stats data successfully moved from renamed_output.json to items_data.json using closest match method")
