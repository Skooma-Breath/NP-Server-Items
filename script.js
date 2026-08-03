const headers = [
    'Item Name', 'Image', 'Max Damage', 'Stats', 'Hidden Effect(s)', 'Spec. Req.', 'Lvl Req.', 'Location/Boss/Event', 'Type', 'Slot', 'Other Notes', 'EV', 'Price',
    'Health', 'Magicka', 'Fatigue', 'Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck',
    'Armorer', 'Athletics', 'Axe', 'Block', 'Blunt Weapon', 'Heavy Armor', 'Long Blade', 'Medium Armor', 'Spear', 'Alchemy', 'Alteration', 'Conjuration',
    'Destruction', 'Enchant', 'Illusion', 'Mysticism', 'Restoration', 'Unarmored', 'Stealth', 'Acrobatics', 'Hand-to-hand', 'Light Armor', 'Marksman',
    'Mercantile', 'Security', 'Short Blade', 'Sneak', 'Speechcraft', 'Fire', 'Frost', 'Shock', 'Poison', 'Disease', 'Reflect', 'Paralyze', 'Light', 'Frenzy Creature',
    'Frenzy Humanoid', 'Demoralize Creature', 'Demoralize Humanoid'
];

const effectHeaders = new Set(headers.slice(headers.indexOf('Health')));
const basicViewHeaders = new Set([
    'Item Name',
    'Image',
    'Max Damage',
    'Stats',
    'Hidden Effect(s)',
    'Spec. Req.',
    'Lvl Req.',
    'Location/Boss/Event',
    'Type',
    'Slot',
    'Other Notes',
    'EV'
]);
const basicViewColumns = new Set(
    headers.map((header, index) => basicViewHeaders.has(header) ? index : null)
        .filter(index => index !== null)
);
const state = {
    items: [],
    filteredItems: [],
    currentPage: 1,
    pageSize: 50,
    sortColumn: null,
    sortAscending: true,
    hiddenColumns: new Set(headers.map((_, index) => index).filter(index => !basicViewColumns.has(index))),
    searchText: ''
};

const elements = {};

window.addEventListener('DOMContentLoaded', init);

async function init() {
    cacheElements();
    buildColumnControls();
    buildTableHeader();
    bindEvents();
    updateColumnVisibility();
    updateToggleButtonText();
    updateBasicViewButtonState();

    try {
        setStatus('Loading item data...');
        const response = await fetch('items_data.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        state.items = data.map(prepareItem);
        state.filteredItems = [...state.items];
        render();
    } catch (error) {
        console.error('Error loading item data:', error);
        setStatus(`Could not load items_data.json: ${error.message}`, true);
    }
}

function cacheElements() {
    elements.search = document.querySelector('#item-search');
    elements.pageSize = document.querySelector('#page-size');
    elements.columnContainer = document.querySelector('#checkbox-container');
    elements.toggleColumns = document.querySelector('#toggle-columns');
    elements.basicView = document.querySelector('#basic-view');
    elements.table = document.querySelector('#itemsTable');
    elements.tableHead = elements.table.querySelector('thead');
    elements.tableBody = elements.table.querySelector('tbody');
    elements.tableScrollContainer = document.querySelector('#table-scroll-container');
    elements.tableScrollbar = document.querySelector('#table-scrollbar');
    elements.tableScrollbarSpacer = document.querySelector('#table-scrollbar-spacer');
    elements.status = document.querySelector('#table-status');
    elements.topPagination = document.querySelector('#pagination-top');
    elements.bottomPagination = document.querySelector('#pagination-bottom');
    elements.columnVisibilityStyle = document.querySelector('#column-visibility-style');
}

function prepareItem(item) {
    return {
        ...item,
        _maxDamage: getMaxDamage(item),
        _searchText: flattenSearchValues(item).join(' ').toLocaleLowerCase()
    };
}

function flattenSearchValues(value) {
    if (value === null || value === undefined) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.flatMap(flattenSearchValues);
    }
    if (typeof value === 'object') {
        return Object.values(value).flatMap(flattenSearchValues);
    }
    return [String(value)];
}

function getMaxDamage(item) {
    const stats = item.Stats || {};
    const damageValues = ['Chop', 'Slash', 'Thrust']
        .flatMap(stat => extractNumbers(stats[stat]));

    return damageValues.length ? Math.max(...damageValues) : null;
}

function extractNumbers(value) {
    if (value === null || value === undefined) {
        return [];
    }

    return String(value)
        .match(/\d+(?:\.\d+)?/g)
        ?.map(Number)
        .filter(Number.isFinite) || [];
}

function buildColumnControls() {
    const fragment = document.createDocumentFragment();
    const sortedHeaders = headers
        .map((header, index) => ({ header, index }))
        .sort((left, right) => left.header.localeCompare(right.header, undefined, {
            numeric: true,
            sensitivity: 'base'
        }));

    sortedHeaders.forEach(({ header, index }) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'column-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'column-checkbox';
        checkbox.id = `column-checkbox-${index}`;
        checkbox.dataset.column = String(index);
        checkbox.checked = !state.hiddenColumns.has(index);

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.className = 'column-label';
        label.textContent = header;

        wrapper.append(checkbox, label);
        fragment.appendChild(wrapper);
    });

    elements.columnContainer.appendChild(fragment);
}

function buildTableHeader() {
    const row = document.createElement('tr');

    headers.forEach((header, index) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.dataset.column = String(index);
        cell.tabIndex = 0;
        cell.setAttribute('aria-sort', 'none');
        cell.textContent = header;
        row.appendChild(cell);
    });

    elements.tableHead.replaceChildren(row);
}

function bindEvents() {
    elements.search.addEventListener('input', debounce(handleSearch, 150));
    elements.pageSize.addEventListener('change', () => {
        const selected = elements.pageSize.value;
        state.pageSize = selected === 'all' ? Number.POSITIVE_INFINITY : Number(selected);
        state.currentPage = 1;
        render();
    });

    elements.columnContainer.addEventListener('change', event => {
        const checkbox = event.target.closest('.column-checkbox');
        if (!checkbox) {
            return;
        }

        const columnIndex = Number(checkbox.dataset.column);
        if (checkbox.checked) {
            state.hiddenColumns.delete(columnIndex);
        } else {
            state.hiddenColumns.add(columnIndex);
        }
        updateColumnVisibility();
        updateToggleButtonText();
        updateBasicViewButtonState();
    });

    elements.toggleColumns.addEventListener('click', () => {
        const shouldShowAll = state.hiddenColumns.size > 0;
        const visibleColumns = shouldShowAll
            ? new Set(headers.map((_, index) => index))
            : new Set();
        setVisibleColumns(visibleColumns);
    });

    elements.basicView.addEventListener('click', () => {
        setVisibleColumns(basicViewColumns);
    });

    elements.tableHead.addEventListener('click', event => {
        const header = event.target.closest('th[data-column]');
        if (header) {
            sortByColumn(Number(header.dataset.column));
        }
    });

    elements.tableHead.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        const header = event.target.closest('th[data-column]');
        if (header) {
            event.preventDefault();
            sortByColumn(Number(header.dataset.column));
        }
    });

    elements.tableBody.addEventListener('click', event => {
        const image = event.target.closest('img.item-thumbnail');
        if (image) {
            displayLargeImage(image.dataset.fullSrc || image.src, image.alt);
        }
    });

    for (const pagination of [elements.topPagination, elements.bottomPagination]) {
        pagination.addEventListener('click', handlePaginationClick);
    }

    elements.tableScrollbar.addEventListener('scroll', () => {
        if (elements.tableScrollContainer.scrollLeft !== elements.tableScrollbar.scrollLeft) {
            elements.tableScrollContainer.scrollLeft = elements.tableScrollbar.scrollLeft;
        }
    });

    elements.tableScrollContainer.addEventListener('scroll', () => {
        if (elements.tableScrollbar.scrollLeft !== elements.tableScrollContainer.scrollLeft) {
            elements.tableScrollbar.scrollLeft = elements.tableScrollContainer.scrollLeft;
        }
    });

    window.addEventListener('resize', debounce(updateScrollbarMetrics, 100));
    if ('ResizeObserver' in window) {
        elements.tableResizeObserver = new ResizeObserver(updateScrollbarMetrics);
        elements.tableResizeObserver.observe(elements.table);
        elements.tableResizeObserver.observe(elements.tableScrollContainer);
    }
}

function handleSearch() {
    state.searchText = elements.search.value.trim().toLocaleLowerCase();
    state.currentPage = 1;

    if (!state.searchText) {
        state.filteredItems = [...state.items];
    } else {
        state.filteredItems = state.items.filter(item => item._searchText.includes(state.searchText));
    }

    applyCurrentSort();
    render();
}

function sortByColumn(columnIndex) {
    if (state.sortColumn === columnIndex) {
        state.sortAscending = !state.sortAscending;
    } else {
        state.sortColumn = columnIndex;
        state.sortAscending = true;
    }

    state.currentPage = 1;
    applyCurrentSort();
    updateSortIndicators();
    render();
}

function applyCurrentSort() {
    if (state.sortColumn === null) {
        return;
    }

    const header = headers[state.sortColumn];
    const direction = state.sortAscending ? 1 : -1;
    state.filteredItems.sort((left, right) => {
        const leftValue = getCellText(left, header);
        const rightValue = getCellText(right, header);

        if (header === 'Max Damage') {
            if (leftValue === '' && rightValue === '') {
                return 0;
            }
            if (leftValue === '') {
                return 1;
            }
            if (rightValue === '') {
                return -1;
            }
            return (Number(leftValue) - Number(rightValue)) * direction;
        }

        return compareValues(leftValue, rightValue) * direction;
    });
}

function compareValues(left, right) {
    const leftText = String(left ?? '').trim();
    const rightText = String(right ?? '').trim();
    const leftNumber = firstNumber(leftText);
    const rightNumber = firstNumber(rightText);

    if (leftNumber !== null && rightNumber !== null) {
        return leftNumber - rightNumber;
    }
    if (leftNumber !== null) {
        return -1;
    }
    if (rightNumber !== null) {
        return 1;
    }
    return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' });
}

function firstNumber(value) {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}

function render() {
    const pageCount = getPageCount();
    state.currentPage = Math.min(Math.max(state.currentPage, 1), pageCount);

    const pageItems = getCurrentPageItems();
    const fragment = document.createDocumentFragment();
    pageItems.forEach(item => fragment.appendChild(createRow(item)));
    elements.tableBody.replaceChildren(fragment);

    updateColumnVisibility();
    updateSortIndicators();
    renderPagination(elements.topPagination, pageCount);
    renderPagination(elements.bottomPagination, pageCount);
    updateStatus(pageItems.length);
}

function getPageCount() {
    if (!Number.isFinite(state.pageSize)) {
        return 1;
    }
    return Math.max(1, Math.ceil(state.filteredItems.length / state.pageSize));
}

function getCurrentPageItems() {
    if (!Number.isFinite(state.pageSize)) {
        return state.filteredItems;
    }
    const start = (state.currentPage - 1) * state.pageSize;
    return state.filteredItems.slice(start, start + state.pageSize);
}

function createRow(item) {
    const row = document.createElement('tr');
    row.dataset.itemName = item['Item Name'] || '';

    headers.forEach(header => {
        const cell = document.createElement('td');
        cell.dataset.label = header;
        if (header === 'Image') {
            cell.appendChild(createThumbnail(item));
        } else {
            cell.textContent = getCellText(item, header);
        }
        row.appendChild(cell);
    });

    return row;
}

function createThumbnail(item) {
    const image = document.createElement('img');
    const itemName = item['Item Name'] || 'Item';
    const source = item.Image || `images/${itemName}.png`;

    image.src = source;
    image.dataset.fullSrc = source;
    image.alt = `${itemName} item card`;
    image.className = 'item-thumbnail';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 72;
    image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied === 'true') {
            return;
        }
        image.dataset.fallbackApplied = 'true';
        image.dataset.fullSrc = 'images/caius.png';
        image.src = 'images/caius.png';
        image.alt = `No image available for ${itemName}`;
        image.classList.add('placeholder-thumbnail');
    }, { once: true });

    return image;
}

function getCellText(item, header) {
    if (header === 'Max Damage') {
        return item._maxDamage ?? '';
    }

    if (header === 'Stats') {
        return Object.entries(item.Stats || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    }

    if (effectHeaders.has(header)) {
        const effect = (item.Effects || []).find(value => effectMatchesHeader(String(value), header));
        return effect || '';
    }

    const value = item[header];
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).map(([key, child]) => `${key}: ${child}`).join(', ');
    }
    return value ?? '';
}

function effectMatchesHeader(effect, header) {
    const normalizedEffect = effect.toLocaleLowerCase();
    const normalizedHeader = header.toLocaleLowerCase();
    const pattern = new RegExp(`(^|[^a-z-])${escapeRegExp(normalizedHeader)}([^a-z-]|$)`, 'i');
    return pattern.test(normalizedEffect);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setVisibleColumns(visibleColumns) {
    state.hiddenColumns.clear();

    elements.columnContainer.querySelectorAll('.column-checkbox').forEach(checkbox => {
        const columnIndex = Number(checkbox.dataset.column);
        const isVisible = visibleColumns.has(columnIndex);
        checkbox.checked = isVisible;
        if (!isVisible) {
            state.hiddenColumns.add(columnIndex);
        }
    });

    updateColumnVisibility();
    updateToggleButtonText();
    updateBasicViewButtonState();
}

function updateColumnVisibility() {
    const rules = [...state.hiddenColumns]
        .sort((left, right) => left - right)
        .map(index => `#itemsTable th:nth-child(${index + 1}), #itemsTable td:nth-child(${index + 1}) { display: none; }`)
        .join('\n');
    elements.columnVisibilityStyle.textContent = rules;
    requestAnimationFrame(updateScrollbarMetrics);
}

function updateScrollbarMetrics() {
    const viewportWidth = elements.tableScrollContainer.clientWidth;
    const tableWidth = elements.tableScrollContainer.scrollWidth;
    elements.tableScrollbarSpacer.style.width = `${Math.max(viewportWidth, tableWidth)}px`;

    const maxScrollLeft = Math.max(0, tableWidth - viewportWidth);
    const scrollLeft = Math.min(elements.tableScrollContainer.scrollLeft, maxScrollLeft);
    elements.tableScrollContainer.scrollLeft = scrollLeft;
    elements.tableScrollbar.scrollLeft = scrollLeft;
}

function updateToggleButtonText() {
    elements.toggleColumns.textContent = state.hiddenColumns.size ? 'Show All Columns' : 'Hide All Columns';
}

function updateBasicViewButtonState() {
    const isBasicView = headers.every((_, index) =>
        basicViewColumns.has(index) === !state.hiddenColumns.has(index)
    );
    elements.basicView.classList.toggle('is-active', isBasicView);
    elements.basicView.setAttribute('aria-pressed', String(isBasicView));
}

function updateSortIndicators() {
    elements.tableHead.querySelectorAll('th[data-column]').forEach((header, index) => {
        header.classList.remove('sorted-ascending', 'sorted-descending');
        header.setAttribute('aria-sort', 'none');
        header.title = `Sort by ${headers[index]}`;

        if (state.sortColumn === index) {
            const direction = state.sortAscending ? 'ascending' : 'descending';
            header.classList.add(`sorted-${direction}`);
            header.setAttribute('aria-sort', direction);
        }
    });
}

function renderPagination(container, pageCount) {
    const disabledAtStart = state.currentPage <= 1;
    const disabledAtEnd = state.currentPage >= pageCount;
    container.innerHTML = `
        <button type="button" data-page-action="first" ${disabledAtStart ? 'disabled' : ''}>First</button>
        <button type="button" data-page-action="previous" ${disabledAtStart ? 'disabled' : ''}>Previous</button>
        <span>Page <strong>${state.currentPage}</strong> of <strong>${pageCount}</strong></span>
        <button type="button" data-page-action="next" ${disabledAtEnd ? 'disabled' : ''}>Next</button>
        <button type="button" data-page-action="last" ${disabledAtEnd ? 'disabled' : ''}>Last</button>
    `;
}

function handlePaginationClick(event) {
    const button = event.target.closest('button[data-page-action]');
    if (!button || button.disabled) {
        return;
    }

    const pageCount = getPageCount();
    switch (button.dataset.pageAction) {
        case 'first':
            state.currentPage = 1;
            break;
        case 'previous':
            state.currentPage = Math.max(1, state.currentPage - 1);
            break;
        case 'next':
            state.currentPage = Math.min(pageCount, state.currentPage + 1);
            break;
        case 'last':
            state.currentPage = pageCount;
            break;
        default:
            return;
    }

    render();
    elements.table.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function updateStatus(renderedCount) {
    if (!state.filteredItems.length) {
        setStatus('No matching items.');
        return;
    }

    const total = state.filteredItems.length;
    const start = Number.isFinite(state.pageSize) ? ((state.currentPage - 1) * state.pageSize) + 1 : 1;
    const end = start + renderedCount - 1;
    const filteredSuffix = total === state.items.length ? '' : ` (${state.items.length} total)`;
    setStatus(`Showing ${start}-${end} of ${total} items${filteredSuffix}.`);
}

function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.classList.toggle('error-message', isError);
}

function displayLargeImage(imageURL, altText) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', altText || 'Item image');

    const image = document.createElement('img');
    image.src = imageURL;
    image.alt = altText || 'Large item image';
    overlay.appendChild(image);

    const close = () => {
        overlay.remove();
        document.body.classList.remove('no-scroll');
        document.removeEventListener('keydown', handleKeydown);
    };
    const handleKeydown = event => {
        if (event.key === 'Escape') {
            close();
        }
    };

    overlay.addEventListener('click', close);
    image.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('keydown', handleKeydown);
    document.body.appendChild(overlay);
    document.body.classList.add('no-scroll');
    overlay.focus();
}

function debounce(callback, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(...args), wait);
    };
}
