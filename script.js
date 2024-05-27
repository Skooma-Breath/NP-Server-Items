const headers = [
  'Item Name', 'Image', 'Stats', 'Hidden Effect(s)', 'Spec. Req.', 'Lvl Req.', 'Location/Boss/Event', 'Type', 'Slot', 'Other Notes', 'EV', 'Price',
  'Health', 'Magicka', 'Fatigue', 'Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck',
  'Armorer', 'Athletics', 'Axe', 'Block', 'Blunt Weapon', 'Heavy Armor', 'Long Blade', 'Medium Armor', 'Spear', 'Alchemy', 'Alteration', 'Conjuration',
  'Destruction', 'Enchant', 'Illusion', 'Mysticism', 'Restoration', 'Unarmored', 'Stealth', 'Acrobatics', 'Hand-to-hand', 'Light Armor', 'Marksman',
  'Mercantile', 'Security', 'Short Blade', 'Sneak', 'Speechcraft', 'Fire', 'Frost', 'Shock', 'Poison', 'Disease', 'Reflect', 'Paralyze', 'Light', 'Frenzy Creature',
  'Frenzy Humanoid', 'Demoralize Creature', 'Demoralize Humanoid'
];

let checkboxContainer = document.createElement('div');
checkboxContainer.id = 'checkbox-container';

// Create toggle button
let toggleButton = document.createElement('button');
toggleButton.textContent = 'Toggle All Columns';
toggleButton.className = 'toggle-button';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.classList.add('container');

    const heading = document.createElement('h1');
    heading.textContent = 'Items Table';

    const searchBar = document.createElement('input');
    searchBar.setAttribute('type', 'text');
    searchBar.setAttribute('placeholder', 'Search...');
    searchBar.classList.add('search-bar');

    checkboxContainer.appendChild(toggleButton);

    const table = document.createElement('table');
    table.id = 'itemsTable';

    container.appendChild(heading);
    container.appendChild(searchBar);
    container.appendChild(checkboxContainer);
    container.appendChild(table);

    headers.forEach((col, index) => {
      const th = document.createElement('th');
      th.textContent = col;

       // Create checkbox for each column
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'column-checkbox';
      checkbox.id = `column-checkbox-${index}`;
      checkbox.dataset.column = index;
      checkbox.checked = true;

      const label = document.createElement('label');
      label.htmlFor = `column-checkbox-${index}`;
      label.className = 'column-label';
      label.textContent = col;

      checkboxContainer.appendChild(checkbox);
      checkboxContainer.appendChild(label);
    });

    document.body.appendChild(container);

    fetch('items_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            populateTable(data);
            addSorting();
            addSearchFunctionality(data);
            displayLocalImages(); // Load and display local images
        })
        .catch(error => {
            console.error('Error loading data:', error);
        });
});

document.addEventListener('DOMContentLoaded', function() {
  const columnCheckboxes = document.querySelectorAll('.column-checkbox');
  const table = document.getElementById('itemsTable');

  let hiddenColumns = [];

  columnCheckboxes.forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
      const columnIndex = parseInt(this.getAttribute('data-column'));

      if (this.checked) {
        table.querySelectorAll(`th:nth-child(${columnIndex + 1}), td:nth-child(${columnIndex + 1})`).forEach(function(cell) {
          cell.style.display = '';
        });
        hiddenColumns = hiddenColumns.filter(col => col !== columnIndex);
      } else {
        table.querySelectorAll(`th:nth-child(${columnIndex + 1}), td:nth-child(${columnIndex + 1})`).forEach(function(cell) {
          cell.style.display = 'none';
        });
        hiddenColumns.push(columnIndex);
      }
    });
  });

  toggleButton.addEventListener('click', function() {
    const allChecked = Array.from(columnCheckboxes).every(cb => cb.checked);
    columnCheckboxes.forEach(function(checkbox) {
      checkbox.checked = !allChecked;
      checkbox.dispatchEvent(new Event('change'));
    });
  });
});

function populateTable(data) {
    const table = document.querySelector('#itemsTable');

    // Add header row
    const headerRow = document.createElement('tr');

    headers.forEach(headerText => {
        const headerCell = document.createElement('th');
        headerCell.textContent = headerText;
        headerRow.appendChild(headerCell);
    });
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Add data rows
    const tableBody = document.createElement('tbody');
    data.forEach(item => {
        const row = createRow(table, item);
        tableBody.appendChild(row);
    });

    // Append tbody element to table
    table.appendChild(tableBody);
}

function createRow(table, item) {
    const row = document.createElement('tr');
    row.setAttribute('data-item-name', item['Item Name']);

    headers.forEach((headerText, index) => {
        const cell = document.createElement('td');
        if (headerText === 'Stats' && item.Stats) {
            const stats = item.Stats;
            cell.textContent = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
        } else if (['Health', 'Magicka', 'Fatigue', 'Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck', 'Armorer', 'Athletics', 'Axe', 'Block', 'Blunt Weapon', 'Heavy Armor', 'Long Blade', 'Medium Armor', 'Spear', 'Alchemy', 'Alteration', 'Conjuration',
        'Destruction', 'Enchant', 'Illusion', 'Mysticism', 'Restoration', 'Unarmored', 'Stealth', 'Acrobatics', 'Hand-to-hand', 'Light Armor', 'Marksman',
        'Mercantile', 'Security', 'Short Blade', 'Sneak', 'Speechcraft', 'Fire', 'Frost', 'Shock', 'Poison', 'Disease', 'Reflect', 'Paralyze', 'Light', 'Frenzy Creature',
        'Frenzy Humanoid', 'Demoralize Creature', 'Demoralize Humanoid'].includes(headerText)) {
            const effect = item.Effects ? item.Effects.find(e => e.toLowerCase().includes(headerText.toLowerCase())) : '';
            cell.textContent = effect; // Extract the value (e.g., "10 pts")
            // cell.textContent = effect ? effect.split(' ').slice(-2).join(' ') : ''; // Extract the value (e.g., "10 pts")
        } else {
            const cellValue = item[headerText] || '';
            if (index === 1 && cellValue.startsWith("http")) { // Assuming the second column is Image
                const img = document.createElement('img');
                img.src = cellValue;
                img.alt = "Image";
                img.style.maxWidth = "50px";
                cell.appendChild(img);
            } else {
                cell.textContent = cellValue;
            }
        }
        row.appendChild(cell);
    });

    return row;
}

function displayLocalImages() {
    const table = document.getElementById('itemsTable');
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const itemName = row.querySelector('td:first-child').textContent.trim();
        const imgPath = `images/${itemName}.png`;

        // Check if the image exists before attempting to fetch it
        checkImageExists(imgPath)
            .then(() => {
                // Image exists, fetch it
                fetch(imgPath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Image not found');
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const imgURL = URL.createObjectURL(blob);
                        const img = document.createElement('img');
                        img.src = imgURL;
                        img.alt = "Image";
                        img.style.maxWidth = "50px";
                        img.classList.add('clickable'); // Add clickable class to each image

                        const imgCell = row.querySelector('td:nth-child(2)');
                        imgCell.innerHTML = '';
                        imgCell.appendChild(img);

                        // Attach click event listener to each image
                        img.addEventListener('click', () => {
                            displayLargeImage(imgURL);
                        });
                    })
                    .catch(error => {
                        // Display placeholder image
                        displayPlaceholderImage(row);
                    });
            })
            .catch(() => {
                // Image does not exist, display placeholder image
                displayPlaceholderImage(row);
            });
    });
}

function checkImageExists(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = imageUrl;
    });
}

function displayPlaceholderImage(row) {
    const img = document.createElement('img');
    img.src = 'images/caius.png'; // Placeholder image path
    img.alt = "Placeholder Image";
    img.style.maxWidth = "50px";
    img.classList.add('clickable'); // Add clickable class to each image

    const imgCell = row.querySelector('td:nth-child(2)');
    imgCell.innerHTML = '';
    imgCell.appendChild(img);

    // Attach click event listener to each image
    img.addEventListener('click', () => {
        displayLargeImage(img.src);
    });
}

function displayLargeImage(imageURL) {
    // Create a modal overlay
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');

    // Create an image element for the large image
    const largeImg = document.createElement('img');
    largeImg.src = imageURL;
    largeImg.alt = "Large Image";

    // Add the large image to the overlay
    overlay.appendChild(largeImg);

    // Append the overlay to the body
    document.body.appendChild(overlay);

    // Close the overlay when clicked outside the image
    overlay.addEventListener('click', () => {
        overlay.remove();
        document.body.style.overflow = 'auto'; // Re-enable scroll bar
    });

    // Prevent scrolling when the overlay is open
    document.body.style.overflow = 'hidden';
}

function addSorting() {
    const headers = document.querySelectorAll('#itemsTable th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            sortTableByColumn(index);
        });
    });
}

let sortAscending = true;

function sortTableByColumn(columnIndex) {
    const table = document.getElementById('itemsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();

        const aNum = parseFloat(aValue.match(/-?\d+(\.\d+)?/));
        const bNum = parseFloat(bValue.match(/-?\d+(\.\d+)?/));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortAscending ? aNum - bNum : bNum - aNum;
        } else {
            return sortAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    tbody.append(...sortedRows);

    sortAscending = !sortAscending;
}

function addSearchFunctionality(data) {
    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('input', debounce(() => {
        const searchText = searchBar.value.toLowerCase().trim();
        const minLength = 2;
        if (searchText.length >= minLength) {
            const filteredData = data.filter(item => {
                return Object.values(item).some(value => {
                    if (typeof value === 'string') {
                        return value.toLowerCase().includes(searchText);
                    }
                    if (typeof value === 'object' && value !== null) {
                        return Object.values(value).some(subValue => {
                            return typeof subValue === 'string' && subValue.toLowerCase().includes(searchText);
                        });
                    }
                    return false;
                });
            });
            updateTable(filteredData);
        } else {
            updateTable(data);
        }
    }, 300));
}

function updateTable(data) {
    const table = document.querySelector('#itemsTable');

    // Clear existing rows
    const tbody = table.querySelector('tbody');
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    // Add new rows
    data.forEach(item => {
        const row = createRow(table, item);
        tbody.appendChild(row);
    });

    // Update column visibility
    const columnCheckboxes = document.querySelectorAll('.column-checkbox');
    columnCheckboxes.forEach(checkbox => {
        const columnIndex = parseInt(checkbox.dataset.column);
        const isChecked = checkbox.checked;
        const cells = table.querySelectorAll(`th:nth-child(${columnIndex + 1}), td:nth-child(${columnIndex + 1})`);
        cells.forEach(cell => {
            cell.style.display = isChecked ? '' : 'none';
        });
    });

    // Display local images for updated table
    displayLocalImages();
}


function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
