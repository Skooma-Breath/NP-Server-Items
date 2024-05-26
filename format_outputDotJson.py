import json

# Load the input data
with open('output.json', 'r') as f:
    data = json.load(f)

# Function to determine if a line is an effect
def is_effect(line):
    return any(keyword in line for keyword in ["pts", "sec", "secs", "Touch", "When", "Charge"])

# Process the data
formatted_data = {}
for key, value in data.items():
    lines = value.split('\n')

    if len(lines) < 2:
        print(f"Skipping malformed entry: {key}")
        continue

    item_name = lines[0]
    weight = None
    item_value = None
    effects = []
    attributes = {}

    for line in lines[1:]:
        if not line.strip():
            continue
        if "Weight:" in line:
            weight = line.split(': ')[1]
        elif "Value:" in line:
            item_value = line.split(': ')[1]
        elif is_effect(line):
            effects.append(line)
        else:
            attribute_key_value = line.split(': ', 1)
            if len(attribute_key_value) == 2:
                attributes[attribute_key_value[0]] = attribute_key_value[1]
            else:
                effects.append(line)

    formatted_data[item_name] = {
        "Weight": weight,
        "Value": item_value,
        "Attributes": attributes if attributes else None,
        "Effects": effects if effects else None
    }

# Save the formatted data
with open('formatted_output.json', 'w') as f:
    json.dump(formatted_data, f, indent=4)

print("Formatting complete. Check formatted_output.json for the results.")
