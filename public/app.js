/**
 * app.js — Interactive Client Logic for Google Maps Scraper Pro UI
 * Handles Dark/Light theme toggling, live crawling SSE stream, filtering,
 * modal details, CSV/JSON exports, outreach shortcuts, and result deletion.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ─── State Management ────────────────────────────────────────────────────────
    let searchQueries = ['gym in new york'];
    let allPlaces = [];
    let isScraping = false;
    let timerInterval = null;
    let scrapeStartTime = null;
    let currentView = 'table'; // 'table' | 'grid'
    let sseSource = null;

    // ─── DOM References ──────────────────────────────────────────────────────────
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const scraperForm = document.getElementById('scraperForm');
    const startScrapeBtn = document.getElementById('startScrapeBtn');
    const stopScrapeBtn = document.getElementById('stopScrapeBtn');
    const startBtnText = document.getElementById('startBtnText');
    const scrapeSpinner = document.getElementById('scrapeSpinner');
    const statusBadge = document.getElementById('statusBadge');

    // Inputs & Sliders
    const queryInput = document.getElementById('queryInput');
    const queryTagsList = document.getElementById('queryTagsList');
    const addQueryBtn = document.getElementById('addQueryBtn');
    const startUrlsInput = document.getElementById('startUrlsInput');
    const maxPlacesSlider = document.getElementById('maxPlacesSlider');
    const maxPlacesVal = document.getElementById('maxPlacesVal');
    const maxReviewsInput = document.getElementById('maxReviewsInput');
    const maxReviewsVal = document.getElementById('maxReviewsVal');
    const deeperCrawlToggle = document.getElementById('deeperCrawlToggle');
    const includeWebResultsToggle = document.getElementById('includeWebResultsToggle');
    const languageSelect = document.getElementById('languageSelect');
    const concurrencySlider = document.getElementById('concurrencySlider');
    const concurrencyVal = document.getElementById('concurrencyVal');
    const proxyUrlsInput = document.getElementById('proxyUrlsInput');

    // Progress & Timer
    const liveProgressContainer = document.getElementById('liveProgressContainer');
    const progressStatusText = document.getElementById('progressStatusText');
    const elapsedTimer = document.getElementById('elapsedTimer');

    // KPIs
    const kpiTotalPlaces = document.getElementById('kpiTotalPlaces');
    const kpiEmails = document.getElementById('kpiEmails');
    const kpiPhones = document.getElementById('kpiPhones');
    const kpiAvgRating = document.getElementById('kpiAvgRating');

    // Explorer & Views
    const filterInput = document.getElementById('filterInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const filterHasEmail = document.getElementById('filterHasEmail');
    const filterHasPhone = document.getElementById('filterHasPhone');
    const filteredCountText = document.getElementById('filteredCountText');
    const tableView = document.getElementById('tableView');
    const cardsGrid = document.getElementById('cardsGrid');
    const placesTableBody = document.getElementById('placesTableBody');
    const viewTableBtn = document.getElementById('viewTableBtn');
    const viewGridBtn = document.getElementById('viewGridBtn');

    // Exports & Deletions
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const headerExportCsvBtn = document.getElementById('headerExportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const directDeleteResultsBtn = document.getElementById('directDeleteResultsBtn');
    const quickActionsBtn = document.getElementById('quickActionsBtn');
    const quickActionsMenu = document.getElementById('quickActionsMenu');
    const copyAllEmailsBtn = document.getElementById('copyAllEmailsBtn');
    const copyAllPhonesBtn = document.getElementById('copyAllPhonesBtn');
    const clearDatasetBtn = document.getElementById('clearDatasetBtn');

    // Modal
    const placeModalOverlay = document.getElementById('placeModalOverlay');
    const modalCategory = document.getElementById('modalCategory');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // ─── Theme Toggle System ─────────────────────────────────────────────────────
    function initTheme() {
        const urlParams = new URLSearchParams(window.location.search);
        const queryTheme = urlParams.get('theme');
        if (queryTheme === 'light' || queryTheme === 'dark') {
            localStorage.setItem('mapintel_theme', queryTheme);
        }

        const savedTheme = localStorage.getItem('mapintel_theme');
        if (savedTheme === 'dark') {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        } else {
            // Default to light theme
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light-theme');
            if (isLight) {
                document.body.classList.remove('light-theme');
                document.body.classList.add('dark-theme');
                localStorage.setItem('mapintel_theme', 'dark');
                showToast('🌙 Dark theme activated', 'success');
            } else {
                document.body.classList.remove('dark-theme');
                document.body.classList.add('light-theme');
                localStorage.setItem('mapintel_theme', 'light');
                showToast('☀️ Light theme activated', 'success');
            }
        });
    }

    // ─── Slider Syncing ──────────────────────────────────────────────────────────
    maxPlacesSlider.addEventListener('input', (e) => {
        maxPlacesVal.textContent = e.target.value;
    });
    maxReviewsInput.addEventListener('input', (e) => {
        maxReviewsVal.textContent = e.target.value;
    });
    concurrencySlider.addEventListener('input', (e) => {
        concurrencyVal.textContent = e.target.value;
    });

    // ─── Query Tags System ───────────────────────────────────────────────────────
    function renderQueryTags() {
        queryTagsList.innerHTML = '';
        searchQueries.forEach((q, idx) => {
            const tag = document.createElement('span');
            tag.className = 'query-tag';
            tag.innerHTML = `
                <span>${escapeHtml(q)}</span>
                <button type="button" class="tag-remove" data-index="${idx}" title="Remove">×</button>
            `;
            queryTagsList.appendChild(tag);
        });
    }

    function addQueryTag(text) {
        const clean = text.trim();
        if (!clean) return;
        if (!searchQueries.includes(clean)) {
            searchQueries.push(clean);
            renderQueryTags();
        }
        queryInput.value = '';
    }

    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addQueryTag(queryInput.value);
        }
    });

    addQueryBtn.addEventListener('click', () => {
        addQueryTag(queryInput.value);
    });

    queryTagsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-remove')) {
            const idx = parseInt(e.target.dataset.index, 10);
            searchQueries.splice(idx, 1);
            renderQueryTags();
        }
    });

    // Preset chips
    document.querySelectorAll('.chip[data-preset]').forEach((chip) => {
        chip.addEventListener('click', () => {
            const preset = chip.getAttribute('data-preset');
            if (preset) {
                addQueryTag(preset);
                showToast(`Added preset: "${preset}"`, 'success');
            }
        });
    });

    // ─── Live Stopwatch Timer ────────────────────────────────────────────────────
    function startTimer(startTime = Date.now()) {
        scrapeStartTime = startTime;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - scrapeStartTime) / 1000);
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            elapsedTimer.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    // ─── Creative Crawler Scanning Animations & Ticker ─────────────────────────
    let scanningAnimInterval = null;
    let currentProgressPct = 20;

    function getCrawlerScanningHtml() {
        const activeQuery = searchQueries[0] || 'Target Search';
        const concurrency = concurrencySlider ? concurrencySlider.value : 3;

        return `
            <div class="crawler-scanning-card">
                <!-- Radar Sonar Visualization -->
                <div class="radar-container">
                    <div class="radar-sweep"></div>
                    <div class="radar-circle radar-circle-1"></div>
                    <div class="radar-circle radar-circle-2"></div>
                    <div class="radar-circle radar-circle-3"></div>
                    <div class="radar-center-pin">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                            <circle cx="12" cy="9" r="2.5" fill="currentColor"/>
                        </svg>
                    </div>
                    <div class="radar-blip blip-1"></div>
                    <div class="radar-blip blip-2"></div>
                    <div class="radar-blip blip-3"></div>
                </div>

                <!-- Dynamic Crawl Status & Info -->
                <div class="scanning-content">
                    <div class="scanning-badge-row">
                        <span class="scanning-live-pill">
                            <span class="pulsing-record-dot"></span>
                            LIVE MAPS CRAWLER
                        </span>
                        <span class="scanning-query-pill" id="emptyQueryPill">🎯 ${escapeHtml(activeQuery)}</span>
                        <span class="scanning-threads-pill">⚡ ${concurrency} Threads</span>
                    </div>

                    <h3 class="scanning-title" id="emptyScanTitle">Scanning Google Maps Directory...</h3>
                    <p class="scanning-desc" id="emptyScanDesc">Playwright stealth engine is scrolling search results, locating places, and extracting emails.</p>

                    <!-- Creative Progress Bar -->
                    <div class="creative-progress-wrapper">
                        <div class="progress-bar-glow-track">
                            <div class="progress-bar-neon-fill" id="emptyProgressBarFill" style="width: 25%;">
                                <span class="progress-neon-flare"></span>
                            </div>
                        </div>
                        <div class="progress-meta-row">
                            <span class="progress-status-msg" id="emptyProgressStatusMsg">Initializing stealth Chromium session...</span>
                            <span class="progress-percent" id="emptyProgressPercent">25%</span>
                        </div>
                    </div>

                    <!-- Pipeline Stages Progress Pills -->
                    <div class="pipeline-steps-row">
                        <div class="pipeline-step active" id="pipeStep1">
                            <span class="step-dot"></span>
                            <span>1. Stealth Browser</span>
                        </div>
                        <div class="pipeline-step" id="pipeStep2">
                            <span class="step-dot"></span>
                            <span>2. Scroll Maps</span>
                        </div>
                        <div class="pipeline-step" id="pipeStep3">
                            <span class="step-dot"></span>
                            <span>3. Extract Emails</span>
                        </div>
                        <div class="pipeline-step" id="pipeStep4">
                            <span class="step-dot"></span>
                            <span>4. Save Leads</span>
                        </div>
                    </div>
                </div>

                <!-- Skeleton Ghost Rows Shimmer -->
                <div class="skeleton-table-preview">
                    <div class="skeleton-row">
                        <span class="skeleton-cell w-30"></span>
                        <span class="skeleton-cell w-15"></span>
                        <span class="skeleton-cell w-10"></span>
                        <span class="skeleton-cell w-20 highlight-emerald"></span>
                        <span class="skeleton-cell w-15"></span>
                    </div>
                    <div class="skeleton-row">
                        <span class="skeleton-cell w-25"></span>
                        <span class="skeleton-cell w-15"></span>
                        <span class="skeleton-cell w-10"></span>
                        <span class="skeleton-cell w-20 highlight-emerald"></span>
                        <span class="skeleton-cell w-15"></span>
                    </div>
                    <div class="skeleton-row">
                        <span class="skeleton-cell w-35"></span>
                        <span class="skeleton-cell w-10"></span>
                        <span class="skeleton-cell w-10"></span>
                        <span class="skeleton-cell w-20 highlight-emerald"></span>
                        <span class="skeleton-cell w-15"></span>
                    </div>
                </div>
            </div>
        `;
    }

    function startScanningAnimTicker() {
        clearInterval(scanningAnimInterval);
        currentProgressPct = 20;
        let elapsed = 0;

        scanningAnimInterval = setInterval(() => {
            if (!isScraping) {
                clearInterval(scanningAnimInterval);
                return;
            }
            elapsed += 1;

            const fill = document.getElementById('emptyProgressBarFill');
            const percentText = document.getElementById('emptyProgressPercent');
            const statusMsg = document.getElementById('emptyProgressStatusMsg');
            const titleMsg = document.getElementById('emptyScanTitle');
            const s1 = document.getElementById('pipeStep1');
            const s2 = document.getElementById('pipeStep2');
            const s3 = document.getElementById('pipeStep3');
            const s4 = document.getElementById('pipeStep4');

            if (!fill || !percentText) return;

            if (elapsed < 5) {
                currentProgressPct = Math.min(38, 20 + elapsed * 3.5);
                if (statusMsg) statusMsg.textContent = 'Launching stealth Chromium & bypassing bot protections...';
                if (titleMsg) titleMsg.textContent = 'Initializing Crawler Engine...';
                if (s1) s1.className = 'pipeline-step active';
                if (s2) s2.className = 'pipeline-step';
                if (s3) s3.className = 'pipeline-step';
                if (s4) s4.className = 'pipeline-step';
            } else if (elapsed < 14) {
                currentProgressPct = Math.min(65, 38 + (elapsed - 5) * 3);
                if (statusMsg) statusMsg.textContent = 'Navigating Google Maps and scrolling business listings...';
                if (titleMsg) titleMsg.textContent = 'Scanning Target Locations...';
                if (s1) s1.className = 'pipeline-step completed';
                if (s2) s2.className = 'pipeline-step active';
                if (s3) s3.className = 'pipeline-step';
                if (s4) s4.className = 'pipeline-step';
            } else if (elapsed < 28) {
                currentProgressPct = Math.min(88, 65 + (elapsed - 14) * 1.6);
                if (statusMsg) statusMsg.textContent = 'Crawling websites for verified emails, phones & socials...';
                if (titleMsg) titleMsg.textContent = 'Extracting Contact Leads...';
                if (s1) s1.className = 'pipeline-step completed';
                if (s2) s2.className = 'pipeline-step completed';
                if (s3) s3.className = 'pipeline-step active';
                if (s4) s4.className = 'pipeline-step';
            } else {
                currentProgressPct = Math.min(96, 88 + (elapsed - 28) * 0.4);
                if (statusMsg) statusMsg.textContent = 'Aggregating business details & formatting dataset...';
                if (titleMsg) titleMsg.textContent = 'Finalizing Lead Records...';
                if (s1) s1.className = 'pipeline-step completed';
                if (s2) s2.className = 'pipeline-step completed';
                if (s3) s3.className = 'pipeline-step completed';
                if (s4) s4.className = 'pipeline-step active';
            }

            const pctRounded = Math.round(currentProgressPct);
            fill.style.width = `${pctRounded}%`;
            percentText.textContent = `${pctRounded}%`;
        }, 1000);
    }

    function stopScanningAnimTicker() {
        clearInterval(scanningAnimInterval);
    }

    // ─── UI Status Updates ───────────────────────────────────────────────────────
    function setRunningState(running, startTime = null) {
        isScraping = running;
        if (running) {
            statusBadge.className = 'status-pill status-running';
            statusBadge.querySelector('.status-text').textContent = 'Engine Scraping...';

            startScrapeBtn.disabled = true;
            scrapeSpinner.classList.remove('hidden');
            startBtnText.textContent = 'Crawling Maps...';
            stopScrapeBtn.classList.remove('hidden');

            liveProgressContainer.classList.remove('hidden');

            startTimer(startTime || Date.now());

            // If table has no items or has filtered 0 items, immediately display the creative scanning animation in .empty-state-row!
            if (allPlaces.length === 0) {
                renderPlaces();
                startScanningAnimTicker();
            }
        } else {
            statusBadge.className = 'status-pill status-idle';
            statusBadge.querySelector('.status-text').textContent = 'Engine Ready';

            startScrapeBtn.disabled = false;
            scrapeSpinner.classList.add('hidden');
            startBtnText.textContent = 'Launch Scraper';
            stopScrapeBtn.classList.add('hidden');

            liveProgressContainer.classList.add('hidden');
            stopTimer();
            stopScanningAnimTicker();
            renderPlaces();
        }
    }

    // ─── SSE Streaming Connection ────────────────────────────────────────────────
    function connectSSE() {
        if (sseSource) sseSource.close();

        sseSource = new EventSource('/api/stream');

        sseSource.addEventListener('status', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.isScraping) {
                    setRunningState(true, data.startTime);
                    if (data.placesCount !== undefined) {
                        progressStatusText.textContent = `Extracted ${data.placesCount} places so far...`;
                    }
                } else if (isScraping) {
                    setRunningState(false);
                }
            } catch (err) {
                console.warn('SSE status parse error:', err);
            }
        });

        sseSource.addEventListener('progress', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.placesCount !== undefined) {
                    progressStatusText.textContent = `Extracted ${data.placesCount} places so far...`;
                    kpiTotalPlaces.textContent = data.placesCount;

                    // Update empty-state progress bar
                    const emptyStatus = document.getElementById('emptyProgressStatusMsg');
                    if (emptyStatus) {
                        emptyStatus.textContent = `Discovered ${data.placesCount} places! Crawling details...`;
                    }
                    const emptyFill = document.getElementById('emptyProgressBarFill');
                    const emptyPct = document.getElementById('emptyProgressPercent');
                    if (emptyFill && emptyPct) {
                        const calculated = Math.min(96, Math.max(currentProgressPct, 40 + data.placesCount * 3));
                        emptyFill.style.width = `${calculated}%`;
                        emptyPct.textContent = `${calculated}%`;
                    }
                }
            } catch (err) {
                console.warn('SSE progress parse error:', err);
            }
        });

        sseSource.addEventListener('log', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.message) {
                    appendTerminalLog(data.message);

                    // If interesting log, preview it in empty state row
                    if (data.message.includes('Saved') || data.message.includes('title') || data.message.includes('place')) {
                        const emptyStatus = document.getElementById('emptyProgressStatusMsg');
                        if (emptyStatus) {
                            emptyStatus.textContent = data.message.replace(/\[.*?\]/g, '').trim().slice(0, 65);
                        }
                    }
                }
            } catch (err) {
                console.warn('SSE log parse error:', err);
            }
        });

        sseSource.addEventListener('finished', (e) => {
            try {
                const data = JSON.parse(e.data);
                setRunningState(false);
                showToast(`🎉 Scraping finished! Extracted ${data.count || 0} places.`, 'success');
                loadResults();
            } catch (err) {
                console.warn('SSE finished parse error:', err);
            }
        });

        sseSource.addEventListener('error', () => {
            // Reconnect handled automatically by EventSource
        });
    }

    // ─── Launch Scraper ──────────────────────────────────────────────────────────
    scraperForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (queryInput.value.trim()) {
            addQueryTag(queryInput.value);
        }

        const startUrlsText = startUrlsInput.value.trim();
        const startUrls = startUrlsText
            ? startUrlsText.split('\n').map((u) => ({ url: u.trim() })).filter((u) => u.url.length > 0)
            : [];

        if (searchQueries.length === 0 && startUrls.length === 0) {
            showToast('Please provide at least one search query or Google Maps URL.', 'error');
            queryInput.focus();
            return;
        }

        const proxyText = proxyUrlsInput.value.trim();
        const proxyUrls = proxyText
            ? proxyText.split('\n').map((p) => p.trim()).filter((p) => p.length > 0)
            : undefined;

        const payload = {
            searchQueries,
            startUrls,
            maxPlacesPerQuery: parseInt(maxPlacesSlider.value, 10),
            maxReviews: parseInt(maxReviewsInput.value, 10),
            maxImages: 0,
            language: languageSelect.value,
            deeperCrawl: deeperCrawlToggle.checked,
            includeWebResults: includeWebResultsToggle.checked,
            maxConcurrency: parseInt(concurrencySlider.value, 10),
            proxyUrls,
        };

        try {
            setRunningState(true);
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to start scraper');
            }

            showToast('Crawler launched! Monitoring live extraction...', 'success');
        } catch (err) {
            setRunningState(false);
            showToast(err.message, 'error');
        }
    });

    // ─── Stop Scraper ────────────────────────────────────────────────────────────
    stopScrapeBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/stop', { method: 'POST' });
            const data = await res.json();
            showToast('Scraper stopped.', 'success');
            setRunningState(false);
            loadResults();
        } catch (err) {
            showToast('Failed to stop scraper: ' + err.message, 'error');
        }
    });

    // ─── Load & Render Results ───────────────────────────────────────────────────
    async function loadResults() {
        try {
            const res = await fetch('/api/results');
            if (!res.ok) return;

            const data = await res.json();
            allPlaces = data.places || [];

            if (data.stats) {
                kpiTotalPlaces.textContent = data.stats.totalPlaces || 0;
                kpiEmails.textContent = data.stats.withEmail || 0;
                kpiPhones.textContent = data.stats.withPhone || 0;
                kpiAvgRating.textContent = data.stats.avgScore || '0.0';

                populateCategoryFilter(data.stats.categories || {});
            }

            renderPlaces();
        } catch (err) {
            console.error('Failed to load results:', err);
        }
    }

    function updateKpisFromLocal() {
        let withEmail = 0;
        let withPhone = 0;
        let withRating = 0;
        let scoreSum = 0;
        const categoryMap = {};

        for (const p of allPlaces) {
            if (p.email && p.email.trim()) withEmail++;
            if (p.phone && p.phone.trim()) withPhone++;
            if (typeof p.totalScore === 'number' && p.totalScore > 0) {
                withRating++;
                scoreSum += p.totalScore;
            }
            const cat = p.category || 'Uncategorized';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        }

        kpiTotalPlaces.textContent = allPlaces.length;
        kpiEmails.textContent = withEmail;
        kpiPhones.textContent = withPhone;
        kpiAvgRating.textContent = withRating > 0 ? (scoreSum / withRating).toFixed(1) : '0.0';
        populateCategoryFilter(categoryMap);
    }

    function populateCategoryFilter(categories) {
        const currentSelected = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';

        const sorted = Object.keys(categories).sort((a, b) => categories[b] - categories[a]);
        for (const cat of sorted) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = `${cat} (${categories[cat]})`;
            categoryFilter.appendChild(opt);
        }

        if (categories[currentSelected]) {
            categoryFilter.value = currentSelected;
        }
    }

    // ─── Filtering & Rendering ───────────────────────────────────────────────────
    function getFilteredPlaces() {
        const q = filterInput.value.toLowerCase().trim();
        const selectedCat = categoryFilter.value;
        const onlyEmail = filterHasEmail.checked;
        const onlyPhone = filterHasPhone.checked;

        return allPlaces.filter((p) => {
            if (onlyEmail && (!p.email || !p.email.trim())) return false;
            if (onlyPhone && (!p.phone || !p.phone.trim())) return false;
            if (selectedCat !== 'all' && (p.category || 'Uncategorized') !== selectedCat) return false;

            if (q) {
                const matchTitle = p.title && p.title.toLowerCase().includes(q);
                const matchCat = p.category && p.category.toLowerCase().includes(q);
                const matchAddr = p.address && p.address.toLowerCase().includes(q);
                const matchEmail = p.email && p.email.toLowerCase().includes(q);
                const matchPhone = p.phone && p.phone.toLowerCase().includes(q);
                return matchTitle || matchCat || matchAddr || matchEmail || matchPhone;
            }

            return true;
        });
    }

    function renderPlaces() {
        const places = getFilteredPlaces();
        filteredCountText.textContent = `Showing ${places.length} of ${allPlaces.length} places`;

        if (places.length === 0) {
            if (isScraping) {
                placesTableBody.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="8">
                            ${getCrawlerScanningHtml()}
                        </td>
                    </tr>
                `;
                cardsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; width: 100%;">
                        ${getCrawlerScanningHtml()}
                    </div>
                `;
            } else {
                placesTableBody.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="8">
                            <div class="empty-state-box">
                                <div class="empty-icon">
                                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                </div>
                                <h3>${allPlaces.length === 0 ? 'No Places Scraped Yet' : 'No Results Match Filter'}</h3>
                                <p>${allPlaces.length === 0 ? 'Enter search terms on the left and click Launch Scraper.' : 'Try clearing your filter or searching for a different keyword.'}</p>
                            </div>
                        </td>
                    </tr>
                `;
                cardsGrid.innerHTML = `
                    <div class="empty-state-box" style="grid-column: 1 / -1;">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <h3>${allPlaces.length === 0 ? 'No Places Scraped Yet' : 'No Results Match Filter'}</h3>
                    </div>
                `;
            }
            return;
        }

        // Render Table View
        placesTableBody.innerHTML = places.map((p, idx) => {
            const hasEmail = p.email && p.email.trim();
            const hasPhone = p.phone && p.phone.trim();
            const ratingDisplay = p.totalScore ? `${p.totalScore.toFixed(1)}` : '—';
            const reviewsCount = p.reviewsCount ? `(${p.reviewsCount})` : '';

            // Social icons
            let socialsHtml = '';
            if (p.website) {
                socialsHtml += `<a href="${p.website}" target="_blank" rel="noopener noreferrer" class="social-icon-link" title="Website"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg></a>`;
            }
            if (p.socialProfiles?.instagram) {
                socialsHtml += `<a href="${p.socialProfiles.instagram}" target="_blank" rel="noopener noreferrer" class="social-icon-link" title="Instagram"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/></svg></a>`;
            }
            if (p.socialProfiles?.linkedin) {
                socialsHtml += `<a href="${p.socialProfiles.linkedin}" target="_blank" rel="noopener noreferrer" class="social-icon-link" title="LinkedIn"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 1-2 2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/></svg></a>`;
            }
            if (p.socialProfiles?.facebook) {
                socialsHtml += `<a href="${p.socialProfiles.facebook}" target="_blank" rel="noopener noreferrer" class="social-icon-link" title="Facebook"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>`;
            }
            if (!socialsHtml) socialsHtml = '<span class="empty-data-dash">—</span>';

            return `
                <tr>
                    <td>
                        <div class="cell-business">
                            <span class="place-title">${escapeHtml(p.title)}</span>
                            ${p.subTitle ? `<span class="place-subtitle">${escapeHtml(p.subTitle)}</span>` : ''}
                        </div>
                    </td>
                    <td><span class="badge-category">${escapeHtml(p.category || 'Business')}</span></td>
                    <td>
                        <span class="score-badge">
                            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            ${ratingDisplay} <span class="reviews-count">${reviewsCount}</span>
                        </span>
                    </td>
                    <td>
                        ${hasEmail ? `<a href="mailto:${p.email}" class="tag-email" title="Click to email">${escapeHtml(p.email)}</a>` : '<span class="empty-data-dash">—</span>'}
                    </td>
                    <td>
                        ${hasPhone ? `<a href="tel:${p.phone}" class="tag-phone">${escapeHtml(p.phone)}</a>` : '<span class="empty-data-dash">—</span>'}
                    </td>
                    <td>
                        <div class="social-links-row">${socialsHtml}</div>
                    </td>
                    <td>
                        <span class="text-secondary" style="font-size: 0.8rem; max-width: 220px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(p.address || '')}">
                            ${escapeHtml(p.address || '—')}
                        </span>
                    </td>
                    <td class="text-right">
                        <div class="table-actions-cell">
                            <button class="btn-action-view" onclick="inspectPlace(${idx})" title="Inspect Details">Inspect</button>
                            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" class="social-icon-link" title="Open Google Maps"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                            <button class="btn-action-delete" onclick="deletePlace(${idx}, event)" title="Delete place">
                                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Cards View
        cardsGrid.innerHTML = places.map((p, idx) => {
            return `
                <div class="place-grid-card">
                    <div>
                        <div class="card-top-row">
                            <span class="badge-category">${escapeHtml(p.category || 'Business')}</span>
                            <span class="score-badge">
                                <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                ${p.totalScore || '—'}
                            </span>
                        </div>
                        <h4 class="grid-place-title" style="margin-top: 8px;">${escapeHtml(p.title)}</h4>
                        <p class="text-secondary" style="font-size: 0.78rem; margin-top: 4px;">${escapeHtml(p.address || 'No address provided')}</p>
                    </div>

                    <div class="card-contact-list">
                        ${p.email ? `<div class="contact-item"><span class="tag-email">${escapeHtml(p.email)}</span></div>` : ''}
                        ${p.phone ? `<div class="contact-item"><span class="tag-phone">${escapeHtml(p.phone)}</span></div>` : ''}
                    </div>

                    <div class="card-footer-row">
                        <button class="btn-action-view" onclick="inspectPlace(${idx})">View Full Details</button>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="font-size: 0.76rem;">Maps ↗</a>` : ''}
                            <button class="btn-action-delete" onclick="deletePlace(${idx}, event)" title="Delete place">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterInput.addEventListener('input', renderPlaces);
    categoryFilter.addEventListener('change', renderPlaces);
    filterHasEmail.addEventListener('change', renderPlaces);
    filterHasPhone.addEventListener('change', renderPlaces);

    // View toggles
    viewTableBtn.addEventListener('click', () => {
        currentView = 'table';
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        tableView.classList.remove('hidden');
        cardsGrid.classList.add('hidden');
    });

    viewGridBtn.addEventListener('click', () => {
        currentView = 'grid';
        viewGridBtn.classList.add('active');
        viewTableBtn.classList.remove('active');
        cardsGrid.classList.remove('hidden');
        tableView.classList.add('hidden');
    });

    // ─── Inspect Modal ───────────────────────────────────────────────────────────
    window.inspectPlace = function(index) {
        const places = getFilteredPlaces();
        const p = places[index];
        if (!p) return;

        modalCategory.textContent = p.category || 'Business Information';
        modalTitle.textContent = p.title;

        // Build reviews section
        let reviewsHtml = '';
        if (p.reviews && p.reviews.length > 0) {
            reviewsHtml = `
                <div>
                    <h5 class="detail-section-title">Customer Reviews (${p.reviews.length})</h5>
                    <div class="reviews-scroll">
                        ${p.reviews.map(r => `
                            <div class="review-item">
                                <div class="review-author-row">
                                    <span>${escapeHtml(r.author || 'Google User')}</span>
                                    <span class="score-badge">★ ${r.rating || ''}</span>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.8rem; line-height: 1.4;">${escapeHtml(r.text || '')}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Build hours section
        let hoursHtml = '';
        if (p.openingHours && p.openingHours.length > 0) {
            hoursHtml = `
                <div>
                    <h5 class="detail-section-title">Operating Hours</h5>
                    <div style="font-size: 0.78rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px;">
                        ${p.openingHours.map(h => `<div style="background: rgba(125,125,125,0.08); padding: 4px 8px; border-radius: 4px;"><strong style="color: var(--primary);">${escapeHtml(h.day)}:</strong> ${escapeHtml(h.hours)}</div>`).join('')}
                    </div>
                </div>
            `;
        }

        modalBody.innerHTML = `
            <div class="modal-grid-2">
                <div class="modal-info-box">
                    <span class="info-box-label">Verified Email</span>
                    <div class="info-box-value">${p.email ? `<a href="mailto:${p.email}" style="color: #10b981; text-decoration: underline;">${escapeHtml(p.email)}</a>` : '<span class="empty-data-dash">Not found</span>'}</div>
                </div>
                <div class="modal-info-box">
                    <span class="info-box-label">Direct Phone</span>
                    <div class="info-box-value">${p.phone ? `<a href="tel:${p.phone}" style="color: #0284c7;">${escapeHtml(p.phone)}</a>` : '<span class="empty-data-dash">Not found</span>'}</div>
                </div>
                <div class="modal-info-box">
                    <span class="info-box-label">Official Website</span>
                    <div class="info-box-value">${p.website ? `<a href="${p.website}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${escapeHtml(p.website)}</a>` : '<span class="empty-data-dash">Not found</span>'}</div>
                </div>
                <div class="modal-info-box">
                    <span class="info-box-label">Rating & Reviews</span>
                    <div class="info-box-value" style="color: #f59e0b;">★ ${p.totalScore || 'N/A'} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${p.reviewsCount || 0} reviews)</span></div>
                </div>
            </div>

            <div class="modal-info-box">
                <span class="info-box-label">Full Address</span>
                <div class="info-box-value" style="font-size: 0.85rem; font-weight: normal; margin-top: 4px;">${escapeHtml(p.address || 'Not specified')}</div>
            </div>

            ${hoursHtml}
            ${reviewsHtml}

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">View on Google Maps ↗</a>` : ''}
            </div>
        `;

        placeModalOverlay.classList.remove('hidden');
    };

    closeModalBtn.addEventListener('click', () => {
        placeModalOverlay.classList.add('hidden');
    });

    placeModalOverlay.addEventListener('click', (e) => {
        if (e.target === placeModalOverlay) {
            placeModalOverlay.classList.add('hidden');
        }
    });

    // ─── Delete Individual Place ─────────────────────────────────────────────────
    window.deletePlace = async function(index, event) {
        if (event) event.stopPropagation();
        const places = getFilteredPlaces();
        const target = places[index];
        if (!target) return;

        if (!confirm(`Are you sure you want to delete "${target.title}"?`)) return;

        const masterIdx = allPlaces.indexOf(target);
        if (masterIdx === -1) return;

        try {
            const res = await fetch(`/api/results/${masterIdx}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                allPlaces.splice(masterIdx, 1);
                updateKpisFromLocal();
                renderPlaces();
                showToast(`🗑️ Deleted "${target.title}"`, 'success');
            } else {
                showToast(data.message || 'Failed to delete record', 'error');
            }
        } catch (err) {
            showToast('Delete error: ' + err.message, 'error');
        }
    };

    // ─── Delete All Results (Direct Explorer Button) ─────────────────────────────
    if (directDeleteResultsBtn) {
        directDeleteResultsBtn.addEventListener('click', async () => {
            if (allPlaces.length === 0) {
                showToast('No results to delete.', 'error');
                return;
            }
            if (!confirm(`Are you sure you want to delete all ${allPlaces.length} scraped results and start fresh?`)) {
                return;
            }

            try {
                const res = await fetch('/api/results', { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast('🗑️ All scraped results deleted successfully.', 'success');
                    allPlaces = [];
                    kpiTotalPlaces.textContent = '0';
                    kpiEmails.textContent = '0';
                    kpiPhones.textContent = '0';
                    kpiAvgRating.textContent = '0.0';
                    renderPlaces();
                } else {
                    showToast(data.message || 'Failed to delete results', 'error');
                }
            } catch (err) {
                showToast('Delete error: ' + err.message, 'error');
            }
        });
    }

    // ─── Export & Quick Actions ──────────────────────────────────────────────────
    function downloadFile(url) {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    exportCsvBtn.addEventListener('click', () => {
        downloadFile('/api/download/csv');
        showToast('Downloading CSV spreadsheet...', 'success');
    });

    headerExportCsvBtn.addEventListener('click', () => {
        downloadFile('/api/download/csv');
        showToast('Downloading CSV spreadsheet...', 'success');
    });

    exportJsonBtn.addEventListener('click', () => {
        downloadFile('/api/download/json');
        showToast('Downloading JSON dataset...', 'success');
    });

    // Quick Actions Dropdown
    quickActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickActionsMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        quickActionsMenu.classList.remove('show');
    });

    // Copy All Emails
    copyAllEmailsBtn.addEventListener('click', () => {
        const emails = [...new Set(allPlaces.map((p) => p.email).filter(Boolean))];
        if (emails.length === 0) {
            showToast('No emails found in current dataset.', 'error');
            return;
        }
        navigator.clipboard.writeText(emails.join(', '));
        showToast(`📋 Copied ${emails.length} unique emails to clipboard!`, 'success');
    });

    // Copy All Phones
    copyAllPhonesBtn.addEventListener('click', () => {
        const phones = [...new Set(allPlaces.map((p) => p.phone).filter(Boolean))];
        if (phones.length === 0) {
            showToast('No phone numbers found in current dataset.', 'error');
            return;
        }
        navigator.clipboard.writeText(phones.join(', '));
        showToast(`📞 Copied ${phones.length} phone numbers to clipboard!`, 'success');
    });

    // Clear Dataset (Dropdown option)
    clearDatasetBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all scraped places and exported files?')) return;

        try {
            const res = await fetch('/api/results', { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('Dataset cleared successfully.', 'success');
                allPlaces = [];
                kpiTotalPlaces.textContent = '0';
                kpiEmails.textContent = '0';
                kpiPhones.textContent = '0';
                kpiAvgRating.textContent = '0.0';
                renderPlaces();
            } else {
                showToast(data.message || 'Failed to clear dataset', 'error');
            }
        } catch (err) {
            showToast('Clear error: ' + err.message, 'error');
        }
    });

    // ─── Toast Notifications ─────────────────────────────────────────────────────
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3600);
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ─── Initialize ──────────────────────────────────────────────────────────────
    initTheme();
    renderQueryTags();
    connectSSE();
    loadResults();
});
