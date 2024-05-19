document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.classList.add('container');

    const heading = document.createElement('h1');
    heading.textContent = 'Items Table';

    const searchBar = document.createElement('input');
    searchBar.setAttribute('type', 'text');
    searchBar.setAttribute('placeholder', 'Search...');
    searchBar.classList.add('search-bar');

    const table = document.createElement('table');
    table.id = 'itemsTable';

    container.appendChild(heading);
    container.appendChild(searchBar);
    container.appendChild(table);

    // Insert the container into the body
    document.body.appendChild(container);

    fetch('items_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            fetch('output.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok ' + response.statusText);
                    }
                    return response.json();
                })
                .then(outputData => {
                    const effectsMap = new Map(Object.entries(outputData));

                    data.forEach(item => {
                        const itemNameWithPng = item['Item Name'] + '.png';
                        if (effectsMap.has(itemNameWithPng)) {
                            item['Effects'] = effectsMap.get(itemNameWithPng);
                        } else {
                            item['Effects'] = '';
                        }
                    });

                    populateTable(data);
                    addSorting();
                    addSearchFunctionality(data);
                    displayLocalImages(); // Load and display local images
                })
                .catch(error => {
                    console.error('Error loading output data:', error);
                });
        })
        .catch(error => {
            console.error('Error loading data:', error);
        });
});

function populateTable(data) {
    const table = document.querySelector('#itemsTable');

    // Add header row
    const headerRow = document.createElement('tr');
    const headers = ['Item Name', 'Image', 'Effects', 'Hidden Effect(s)', 'Spec. Req.', 'Lvl Req.', 'Location/Boss/Event', 'Type', 'Slot', 'Other Notes', 'EV', 'Price'];
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
        const row = document.createElement('tr');

        headers.forEach((headerText, index) => {
            const cell = document.createElement('td');
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
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });

    // Append tbody element to table
    table.appendChild(tableBody);
}

function addSorting() {
    const headers = document.querySelectorAll('#itemsTable th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            sortTableByColumn(index);
        });
    });
}

let sortAscending = true; // Track sorting order

function sortTableByColumn(columnIndex) {
    const table = document.getElementById('itemsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const sortedRows = rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${columnIndex + 1})`).textContent.trim();

        if (!isNaN(parseFloat(aValue)) && !isNaN(parseFloat(bValue))) {
            return sortAscending ? parseFloat(aValue) - parseFloat(bValue) : parseFloat(bValue) - parseFloat(aValue);
        } else {
            return sortAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    tbody.append(...sortedRows);

    // Toggle sorting order
    sortAscending = !sortAscending;
}

function addSearchFunctionality(data) {
    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('input', debounce(() => {
        const searchText = searchBar.value.toLowerCase().trim(); // Trim whitespace
        const minLength = 2; // Minimum input length
        if (searchText.length >= minLength) {
            const filteredData = data.filter(item =>
                Object.values(item).some(value => typeof value === 'string' && value.toLowerCase().includes(searchText))
            );
            updateTable(filteredData);
        } else {
            updateTable(data); // Reset table if input length is below minimum
        }
    }, 300)); // Adjust delay as needed
}

function updateTable(data) {
    const tableBody = document.querySelector('#itemsTable tbody');
    tableBody.innerHTML = '';

    const headers = ['Item Name', 'Image', 'Effects', 'Hidden Effect(s)', 'Spec. Req.', 'Lvl Req.', 'Location/Boss/Event', 'Type', 'Slot', 'Other Notes', 'EV', 'Price'];

    data.forEach(item => {
        const row = document.createElement('tr');

        headers.forEach((headerText, index) => {
            const cell = document.createElement('td');
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
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });

    // Display local images after updating the table
    displayLocalImages();
}

function createRow(item) {
    const row = document.createElement('tr');
    row.setAttribute('data-item-name', item['Item Name']);

    const headers = ['Item Name', 'Image', 'Effects', 'Hidden Effect(s)', 'Spec. Req.', 'Lvl Req.', 'Location/Boss/Event', 'Type', 'Slot', 'Other Notes', 'EV', 'Price'];

    headers.forEach((headerText, index) => {
        const cell = document.createElement('td');
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

// Function to debounce search input
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // Existing code...

    // Add debounced input event listener to search bar with minimum input length
    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('input', debounce(() => {
        const searchText = searchBar.value.toLowerCase().trim(); // Trim whitespace
        const minLength = 2; // Minimum input length
        if (searchText.length >= minLength) {
            const filteredData = data.filter(item =>
                Object.values(item).some(value => typeof value === 'string' && value.toLowerCase().includes(searchText))
            );
            updateTable(filteredData);
        } else {
            updateTable(data); // Reset table if input length is below minimum
        }
    }, 300)); // Adjust delay as needed
});
