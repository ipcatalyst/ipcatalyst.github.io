// ========================================
// Configuration & State Management
// ========================================

const CONFIG = {
    endpoints: {
        azure: 'https://enginuityai-api.azure-api.net/api/v0',
        local: 'http://localhost:7071/api'
    },
    defaultKey: ''
};

const STATE = {
    currentEndpoint: 'azure',
    apiKey: CONFIG.defaultKey,
    orgUuid: null,
    portfolioUuid: null,
    selectedSources: [],
    analysisUuid: null,
    reportUuid: null,
    selectedReportType: null
};

// ========================================
// Utility Functions
// ========================================

function getBaseURL() {
    return CONFIG.endpoints[STATE.currentEndpoint];
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': STATE.apiKey
    };
}

async function apiRequest(endpoint, options = {}) {
    const url = `${getBaseURL()}/${endpoint}`;
    const config = {
        ...options,
        headers: getHeaders()
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}



// ========================================
// API Functions
// ========================================

async function createOrg() {
    showLoading();
    try {
        const data = await apiRequest('org', {
            method: 'POST',
            body: JSON.stringify({})
        });

        STATE.orgUuid = data.org_uuid;
        document.getElementById('org-uuid').textContent = STATE.orgUuid;
        document.getElementById('org-display').classList.remove('hidden');
        document.getElementById('org-setup').classList.add('hidden');

        showToast('Organization created successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error creating organization: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function getSources() {
    showLoading();
    try {
        const data = await apiRequest('demand-sources', {
            method: 'GET'
        });

        displaySources(data.sources);
        showToast('Sources fetched successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error fetching sources: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function createPortfolio() {
    if (!STATE.orgUuid) {
        showToast('Please create an organization first!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('portfolio', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid
            })
        });

        STATE.portfolioUuid = data.portfolio_uuid;
        document.getElementById('portfolio-uuid').textContent = STATE.portfolioUuid;
        document.getElementById('portfolio-display').classList.remove('hidden');
        document.getElementById('portfolio-create').classList.add('hidden');

        showToast('Portfolio created successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error creating portfolio: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function addRecords(records) {
    if (!STATE.orgUuid || !STATE.portfolioUuid) {
        showToast('Please create an organization and portfolio first!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('records', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                portfolio_uuid: STATE.portfolioUuid,
                records: records
            })
        });

        showToast(`${records.length} record(s) added successfully!`, 'success');
        return data;
    } catch (error) {
        showToast(`Error adding records: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function getPortfolioRecords() {
    if (!STATE.orgUuid || !STATE.portfolioUuid) {
        showToast('Please create an organization and portfolio first!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('portfolio-records', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                portfolio_uuid: STATE.portfolioUuid
            })
        });

        displayRecords(data.records);
        showToast('Records fetched successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error fetching records: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function analyzePortfolio() {
    if (!STATE.orgUuid || !STATE.portfolioUuid) {
        showToast('Please create an organization and portfolio first!', 'error');
        return;
    }

    if (STATE.selectedSources.length === 0) {
        showToast('Please select at least one data source!', 'error');
        return;
    }

    // Read analysis option controls
    const topK = parseInt(document.getElementById('analysis-top-k').value, 10) || 10;
    const weightsRaw = document.getElementById('analysis-weights').value.trim();
    const weights = weightsRaw
        ? weightsRaw.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w))
        : null;
    const onlyOpen = document.getElementById('analysis-only-open').checked;
    const useHybridSearch = document.getElementById('analysis-hybrid-search').checked;

    showLoading();
    try {
        const data = await apiRequest('analyze', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                portfolio_uuid: STATE.portfolioUuid,
                sources: STATE.selectedSources,
                top_k: topK,
                weights: weights,
                only_open: onlyOpen,
                use_hybrid_search: useHybridSearch
            })
        });

        STATE.analysisUuid = data.analysis_uuid;

        const statusEl = document.getElementById('analysis-status');
        statusEl.textContent = `Analysis started! UUID: ${STATE.analysisUuid}`;
        statusEl.className = 'status-message info';
        statusEl.classList.remove('hidden');

        showToast('Analysis started successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error starting analysis: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function getScores() {
    if (!STATE.orgUuid || !STATE.analysisUuid) {
        showToast('Please run analysis first!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('scores', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                analysis_uuid: STATE.analysisUuid
            })
        });

        displayScores(data);
        showToast('Scores fetched successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error fetching scores: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function generateReport(reportType) {
    if (!STATE.orgUuid || !STATE.analysisUuid) {
        showToast('Please run analysis first!', 'error');
        return;
    }

    if (!reportType) {
        showToast('Please select a report type!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('report', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                analysis_uuid: STATE.analysisUuid,
                report_type: reportType
            })
        });

        STATE.reportUuid = data.report_uuid;

        const statusEl = document.getElementById('report-generation-status');
        statusEl.textContent = `Report generation started! UUID: ${STATE.reportUuid}`;
        statusEl.className = 'status-message info';
        statusEl.classList.remove('hidden');

        showToast('Report generation started!', 'success');
        return data;
    } catch (error) {
        showToast(`Error generating report: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function fetchReport() {
    if (!STATE.orgUuid || !STATE.reportUuid) {
        showToast('Please generate a report first!', 'error');
        return;
    }

    showLoading();
    try {
        const data = await apiRequest('fetch-report', {
            method: 'POST',
            body: JSON.stringify({
                org_uuid: STATE.orgUuid,
                report_uuid: STATE.reportUuid
            })
        });

        displayReport(data);
        showToast('Report fetched successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error fetching report: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

async function getReportTypes() {
    showLoading();
    try {
        const data = await apiRequest('report-types', {
            method: 'GET'
        });

        displayReportTypes(data);
        showToast('Report types fetched successfully!', 'success');
        return data;
    } catch (error) {
        showToast(`Error fetching report types: ${error.message}`, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// ========================================
// Display Functions
// ========================================

function displaySources(sources) {
    const container = document.getElementById('sources-list');
    container.innerHTML = '';

    if (!sources || sources.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); margin-top: 1rem;">No sources available</p>';
        return;
    }

    sources.forEach((source) => {
        const item = document.createElement('div');
        item.className = 'source-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `source-${source.uuid}`;
        checkbox.value = source.uuid;
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                STATE.selectedSources.push(source.uuid);
            } else {
                STATE.selectedSources = STATE.selectedSources.filter(id => id !== source.uuid);
            }
        });

        const label = document.createElement('label');
        label.htmlFor = `source-${source.uuid}`;
        label.textContent = source.name || 'Unknown Source';

        label.insertBefore(checkbox, label.firstChild);
        item.appendChild(label);
        container.appendChild(item);
    });
}

function displayRecords(records) {
    const container = document.getElementById('records-list');
    container.innerHTML = '';

    if (!records || records.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); margin-top: 1rem;">No records in portfolio</p>';
        return;
    }

    records.forEach(record => {
        const item = document.createElement('div');
        item.className = 'record-item';

        const title = document.createElement('h4');
        title.textContent = record.title || 'Untitled';

        const summary = document.createElement('p');
        summary.textContent = record.summary || 'No summary available';

        item.appendChild(title);
        item.appendChild(summary);
        container.appendChild(item);
    });
}

function displayScores(data) {
    const container = document.getElementById('scores-container');
    container.innerHTML = '';

    if (!data.analysis_results || data.analysis_results.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); margin-top: 1rem;">No scores available</p>';
        return;
    }

    data.analysis_results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'score-card';

        // Record header
        const header = document.createElement('div');
        header.className = 'score-card-header';

        const title = document.createElement('h4');
        title.textContent = result.title || 'Untitled';
        header.appendChild(title);

        if (result.summary) {
            const summary = document.createElement('p');
            summary.className = 'score-card-summary';
            summary.textContent = result.summary;
            header.appendChild(summary);
        }

        card.appendChild(header);

        // References table
        if (result.references && result.references.length > 0) {
            const tableWrap = document.createElement('div');
            tableWrap.className = 'refs-table-wrap';

            const table = document.createElement('table');
            table.className = 'refs-table';

            // Header row
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th class="col-score">Score</th>
                    <th class="col-title">Title</th>
                    <th class="col-status">Status</th>
                    <th class="col-value">Value</th>
                    <th class="col-date">Closing Date</th>
                </tr>`;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            result.references.forEach(ref => {
                const tr = document.createElement('tr');

                // Score
                const scoreVal = ref.score != null ? ref.score.toFixed(3) : '—';
                const scoreTd = document.createElement('td');
                scoreTd.className = 'col-score';
                scoreTd.innerHTML = `<span class="ref-score-badge">${scoreVal}</span>`;

                // Title
                const titleTd = document.createElement('td');
                titleTd.className = 'col-title';
                titleTd.textContent = ref.title || '—';

                // Status
                const statusTd = document.createElement('td');
                statusTd.className = 'col-status';
                if (ref.status) {
                    const badge = document.createElement('span');
                    badge.className = `status-badge status-${(ref.status || '').toLowerCase().replace(/\s+/g, '-')}`;
                    badge.textContent = ref.status;
                    statusTd.appendChild(badge);
                } else {
                    statusTd.textContent = '—';
                }

                // Value + currency
                const valueTd = document.createElement('td');
                valueTd.className = 'col-value';
                if (ref.value != null && ref.value !== '') {
                    const currency = ref.currency ? ref.currency + '\u00a0' : '';
                    valueTd.textContent = currency + Number(ref.value).toLocaleString();
                } else {
                    valueTd.textContent = '—';
                }

                // Closing date
                const dateTd = document.createElement('td');
                dateTd.className = 'col-date';
                dateTd.textContent = ref.closing_date || '—';

                tr.appendChild(scoreTd);
                tr.appendChild(titleTd);
                tr.appendChild(statusTd);
                tr.appendChild(valueTd);
                tr.appendChild(dateTd);
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            tableWrap.appendChild(table);
            card.appendChild(tableWrap);
        } else {
            const noRefs = document.createElement('p');
            noRefs.className = 'no-refs';
            noRefs.textContent = 'No references found.';
            card.appendChild(noRefs);
        }

        container.appendChild(card);
    });
}

function displayReportTypes(data) {
    const container = document.getElementById('report-types-list');
    container.innerHTML = '';

    // Handle different possible data structures
    let reportTypes = data;

    // If data has a 'report_types' property, use that
    if (data.report_types) {
        reportTypes = data.report_types;
    }

    // If it's an array, convert to object
    if (Array.isArray(reportTypes)) {
        const tempObj = {};
        reportTypes.forEach((type, index) => {
            tempObj[index] = typeof type === 'string' ? { name: type } : type;
        });
        reportTypes = tempObj;
    }

    if (!reportTypes || Object.keys(reportTypes).length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); margin-top: 1rem;">No report types available</p>';
        return;
    }

    Object.entries(reportTypes).forEach(([uuid, typeData]) => {
        const item = document.createElement('div');
        item.className = 'report-type-item';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'report-type';
        radio.id = `report-type-${uuid}`;

        // Try multiple possible field names for the report type name
        const typeName = typeData.name || typeData.type || typeData.report_type || typeData || uuid;
        radio.value = typeName;
        radio.addEventListener('change', (e) => {
            STATE.selectedReportType = e.target.value;
        });

        const label = document.createElement('label');
        label.htmlFor = `report-type-${uuid}`;
        label.textContent = typeName;

        label.insertBefore(radio, label.firstChild);
        item.appendChild(label);
        container.appendChild(item);
    });
}

function displayReport(data) {
    const container = document.getElementById('report-display');
    container.innerHTML = '';

    if (!data.report) {
        container.innerHTML = '<p style="color: var(--text-muted);">No report data available</p>';
        return;
    }

    const report = data.report;

    // Executive Summary
    if (report.executive_summary) {
        const section = document.createElement('div');
        section.className = 'report-section';

        const title = document.createElement('h4');
        title.textContent = 'Executive Summary';

        const content = document.createElement('p');
        content.textContent = report.executive_summary;

        section.appendChild(title);
        section.appendChild(content);
        container.appendChild(section);
    }

    // Detailed Report
    if (report.details && Array.isArray(report.details)) {
        report.details.forEach((detail, index) => {
            const section = document.createElement('div');
            section.className = 'report-section';

            const title = document.createElement('h4');
            title.textContent = detail.title || `Record ${index + 1}`;

            const summary = document.createElement('p');
            summary.textContent = detail.summary || '';

            section.appendChild(title);
            section.appendChild(summary);
            container.appendChild(section);
        });
    }

    // If report has a 'detials' field (typo in mock data)
    if (report.detials && Array.isArray(report.detials)) {
        report.detials.forEach((detail, index) => {
            const section = document.createElement('div');
            section.className = 'report-section';

            const title = document.createElement('h4');
            title.textContent = detail.title || `Record ${index + 1}`;

            const summary = document.createElement('p');
            summary.textContent = detail.summary || '';

            section.appendChild(title);
            section.appendChild(summary);

            // Show scores if available
            if (detail.scores) {
                const scoresP = document.createElement('p');
                scoresP.innerHTML = `<strong>Scores:</strong> Total: ${detail.scores.total}, Market: ${detail.scores.market}, Competitive: ${detail.scores.competitive}, Funding: ${detail.scores.funding}`;
                section.appendChild(scoresP);
            }

            container.appendChild(section);
        });
    }
}

// ========================================
// Event Listeners
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check for saved configuration
    const savedApiKey = localStorage.getItem('apiKey');
    const savedOrgUuid = localStorage.getItem('orgUuid');
    const savedEndpoint = localStorage.getItem('endpoint');
    const hasVisited = localStorage.getItem('hasVisited');

    // If user has saved credentials, load them
    if (savedApiKey) {
        STATE.apiKey = savedApiKey;
    }

    if (savedOrgUuid) {
        STATE.orgUuid = savedOrgUuid;
    }

    if (savedEndpoint) {
        STATE.currentEndpoint = savedEndpoint;
    }

    // Show modal on first visit
    if (!hasVisited) {
        document.getElementById('config-modal').classList.remove('hidden');
    }

    // Handle modal configuration form
    document.getElementById('config-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const apiKey = document.getElementById('modal-api-key').value;
        const orgUuid = document.getElementById('modal-org-uuid').value;

        // Save to localStorage (always use Azure as default)
        localStorage.setItem('endpoint', 'azure');
        localStorage.setItem('apiKey', apiKey);
        localStorage.setItem('orgUuid', orgUuid);
        localStorage.setItem('hasVisited', 'true');

        // Update STATE
        STATE.currentEndpoint = 'azure';
        STATE.apiKey = apiKey;
        STATE.orgUuid = orgUuid;

        // Hide modal
        document.getElementById('config-modal').classList.add('hidden');

        showToast('Configuration saved successfully!', 'success');
    });

    // Handle logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        // Clear all localStorage
        localStorage.clear();

        // Reload the page to show login modal again
        location.reload();
    });



    // Sources
    document.getElementById('fetch-sources-btn').addEventListener('click', getSources);

    // Portfolio
    document.getElementById('create-portfolio-btn').addEventListener('click', createPortfolio);
    document.getElementById('use-portfolio-btn').addEventListener('click', () => {
        const manualUuid = document.getElementById('manual-portfolio-uuid').value.trim();
        if (manualUuid) {
            STATE.portfolioUuid = manualUuid;
            document.getElementById('portfolio-uuid').textContent = STATE.portfolioUuid;
            document.getElementById('portfolio-display').classList.remove('hidden');
            document.getElementById('portfolio-create').classList.add('hidden');
            showToast('Using provided portfolio UUID', 'success');
        } else {
            showToast('Please enter a valid portfolio UUID', 'error');
        }
    });

    // Add Records Form
    document.getElementById('add-record-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('record-title').value;
        const abstract = document.getElementById('record-abstract').value;

        await addRecords([{
            title: title,
            summary: abstract
        }]);

        // Clear form
        e.target.reset();
    });

    // View Records
    document.getElementById('view-records-btn').addEventListener('click', getPortfolioRecords);

    // Analysis
    document.getElementById('analyze-btn').addEventListener('click', analyzePortfolio);
    document.getElementById('use-analysis-btn').addEventListener('click', () => {
        const manualUuid = document.getElementById('manual-analysis-uuid').value.trim();
        if (manualUuid) {
            STATE.analysisUuid = manualUuid;
            const statusEl = document.getElementById('analysis-status');
            statusEl.textContent = `Using Analysis UUID: ${STATE.analysisUuid}`;
            statusEl.className = 'status-message info';
            statusEl.classList.remove('hidden');
            showToast('Using provided analysis UUID', 'success');
        } else {
            showToast('Please enter a valid analysis UUID', 'error');
        }
    });
    document.getElementById('fetch-scores-btn').addEventListener('click', getScores);

    // Reports
    document.getElementById('fetch-report-types-btn').addEventListener('click', getReportTypes);
    document.getElementById('generate-report-btn').addEventListener('click', () => {
        generateReport(STATE.selectedReportType);
    });
    document.getElementById('use-report-btn').addEventListener('click', () => {
        const manualUuid = document.getElementById('manual-report-uuid').value.trim();
        if (manualUuid) {
            STATE.reportUuid = manualUuid;
            const statusEl = document.getElementById('report-generation-status');
            statusEl.textContent = `Using Report UUID: ${STATE.reportUuid}`;
            statusEl.className = 'status-message info';
            statusEl.classList.remove('hidden');
            showToast('Using provided report UUID', 'success');
        } else {
            showToast('Please enter a valid report UUID', 'error');
        }
    });
    document.getElementById('fetch-report-btn').addEventListener('click', fetchReport);
});
