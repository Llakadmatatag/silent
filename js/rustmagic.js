// Function to create coin icon with amount
function createCoinElement(amount, size = 16) {
    const container = document.createElement('span');
    container.className = 'coin-amount';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px';
    
    const amountSpan = document.createElement('span');
    amountSpan.textContent = amount;
    
    const coinImg = document.createElement('img');
    coinImg.src = 'images/rust-magic-coin.svg';
    coinImg.alt = 'Coins';
    coinImg.style.width = `${size}px`;
    coinImg.style.height = `${size}px`;
    coinImg.style.display = 'inline-block';
    coinImg.style.verticalAlign = 'middle';
    
    container.appendChild(amountSpan);
    container.appendChild(coinImg);
    
    return container;
}

// Format prize based on rank
function getPrize(rank) {
    const prizes = {
        1: '100',
        2: '75',
        3: '50',
    };
    return prizes[rank] || '-';
}

// Track API errors and rate limiting
let errorCount = 0;
const MAX_ERRORS_BEFORE_STOP = 2;
let refreshInterval;
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests
let lastRequestTime = 0;

// Google Sheets configuration
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTD-izNeTjWAsznv7WwIwLm6kWHMp0GEk580Dzr_192u4bkrJHNDaMf9GMJCHsK2CPK_B1Lc4nxojon/pub?output=csv';
// Fallback URL in case of CORS issues
const SHEET_PROXY = 'https://cors-anywhere.herokuapp.com/';

// Helper function to parse CSV with proper handling of quoted values and decimal commas
deserializeCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s"]+/g, ''));
    
    return lines.slice(1).map(line => {
        // Handle quoted values with commas
        const values = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());
        
        return headers.reduce((obj, header, i) => {
            // Clean up the value and convert numeric strings to proper format
            let value = (values[i] || '').trim().replace(/^"|"$/g, '');
            
            // Convert numeric values (handle both . and , as decimal separators)
            if (/^[\d,.]+$/.test(value)) {
                // Replace comma with dot for proper number parsing
                const numericValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(numericValue)) {
                    value = numericValue.toFixed(2);
                }
            }
            
            obj[header] = value;
            return obj;
        }, {});
    });
};

// Update leaderboard with data from Google Sheets
async function updateLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboard-body');
    const loadingRow = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 2rem;">
                <p>Loading leaderboard data...</p>
            </td>
        </tr>`;
    
    if (!leaderboardBody) return;
    
    // Show loading state
    leaderboardBody.innerHTML = loadingRow;
    
    try {
        // Add delay if needed to respect rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
        }
        
        // Update last request time
        lastRequestTime = Date.now();
        
        // Fetch data from published Google Sheet
        let response;
        try {
            // Try direct fetch first
            response = await fetch(SHEET_URL);
            
            // If we get a CORS error, try with proxy
            if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
                throw new Error('CORS error or invalid content type');
            }
        } catch (error) {
            console.log('Direct fetch failed, trying with proxy...', error);
            // Try with CORS proxy
            response = await fetch(SHEET_PROXY + SHEET_URL);
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const csvData = deserializeCSV(csvText);
        
        // Reset error count on successful response
        errorCount = 0;
        
        if (csvData && csvData.length > 0) {
            // Process the data
            const leaderboardData = csvData.map((row, index) => {
                // Get values by column name (case-insensitive)
                const getValue = (obj, keys) => {
                    const lowerKeys = keys.map(k => k.toLowerCase());
                    const key = Object.keys(obj).find(k => 
                        lowerKeys.includes(k.toLowerCase())
                    );
                    return key ? obj[key] : '';
                };
                
                const username = getValue(row, ['username', 'name', 'player', 'nama']) || 'Anonymous';
                const wagered = parseFloat(getValue(row, ['totalwagered', 'wagered', 'amount', 'jumlah', 'total']) || '0').toFixed(2);
                
                return {
                    rank: (index + 1),
                    username: username,
                    avatar: getValue(row, ['avatarurl', 'avatar', 'image', 'foto']),
                    wagered: wagered
                };
            }).filter(player => player.username && player.username !== 'Username');
            
            if (leaderboardData.length > 0) {
                displayLeaderboard(leaderboardData);
            } else {
                showError('Leaderboard is empty. Be the first to join!');
            }
        } else {
            showError('No data available in the spreadsheet');
        }
        
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        errorCount++;
        
        // Log additional error details
        if (error.response) {
            console.error('Error response:', error.response.status, error.response.data);
        } else if (error.request) {
            console.error('No response from server');
        }
        
        // Handle different types of errors
        let errorMessage = error.message || 'An unknown error occurred';
        
        if (error instanceof TypeError) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'Connection issue with the server. Please try again later or contact the administrator.';
            } else if (error.message.includes('Rate limit') || error.message.includes('rate limit') || error.message.includes('too many requests')) {
                errorMessage = 'Too many requests to the server. Please wait a moment before trying again.';
                // Increase the interval between requests when rate limited
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = setInterval(updateLeaderboard, 60000); // 1 minute
                }
            }
        } else if (error.message.includes('500')) {
            errorMessage = 'The server is currently experiencing issues. Please try again later.';
        }
        
        // Show appropriate error message
        if (errorCount >= MAX_ERRORS_BEFORE_STOP) {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
            showError(`${errorMessage}<br><small>Auto-refresh disabled after multiple failures. Please refresh the page to try again.</small>`, true);
        } else {
            showError(errorMessage);
        }
    }
}

// Display leaderboard data in the table
function displayLeaderboard(players) {
    const leaderboardBody = document.getElementById('leaderboard-body');
    if (!leaderboardBody) return;
    
    try {
        // Sort players by wagered amount (descending)
        const sortedPlayers = [...players].sort((a, b) => {
            const wageredA = parseFloat(a.wagered) || 0;
            const wageredB = parseFloat(b.wagered) || 0;
            return wageredB - wageredA;
        });
        
        // Create table rows for each player (max 20)
        let tableHTML = '';
        const maxPlayers = Math.max(20, 5); // Show at least 5 rows
        
        // Fill with actual data first
        for (let i = 0; i < Math.max(sortedPlayers.length, 5); i++) {
            const player = sortedPlayers[i];
            const rank = i + 1;
            
            if (player) {
                const username = player.username;
                const wagered = player.wagered ? parseFloat(player.wagered).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) : '0.00';
                
                // Create avatar HTML if available
                const avatarHtml = player.avatar 
                    ? `<img src="${player.avatar}" alt="${username}" class="player-avatar"> ` 
                    : '';
                
                // Create row with player data
                const prize = getPrize(rank);
                const wageredWithIcon = createCoinElement(wagered).outerHTML;
                const prizeWithIcon = prize !== '-' ? createCoinElement(prize).outerHTML : '-';
                
                // Add special class for top 3 ranks
                const rowClass = rank <= 3 ? `class="top-rank rank-${rank}"` : '';
                
                tableHTML += `
                    <tr ${rowClass}>
                        <td>#${rank}</td>
                        <td>${avatarHtml}${username}</td>
                        <td>${wageredWithIcon}</td>
                        <td>${prizeWithIcon}</td>
                    </tr>`;
            } else {
                // Create empty row with just the rank and prize
                const prize = getPrize(rank);
                const prizeWithIcon = prize !== '-' ? createCoinElement(prize).outerHTML : '-';
                
                // Add special class for top 3 ranks even for empty rows
                const rowClass = rank <= 3 ? `class="top-rank rank-${rank}"` : '';
                
                tableHTML += `
                    <tr ${rowClass}>
                        <td>#${rank}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${prizeWithIcon}</td>
                    </tr>`;
            }
        }
        
        leaderboardBody.innerHTML = tableHTML;
    } catch (error) {
        console.error('Error displaying leaderboard data');
        showError('Error displaying leaderboard data');
    }
    
    // Add some CSS for the avatar and coins
    const style = document.createElement('style');
    style.textContent = `
        .player-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-right: 8px;
            vertical-align: middle;
        }
        .leaderboard-table td {
            vertical-align: middle;
        }
        .coin-amount {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
        }
        .coin-amount img {
            width: 16px;
            height: 16px;
            object-fit: contain;
        }
        .leaderboard-table td:last-child .coin-amount {
            font-weight: bold;
            color: #ffd700;
        }
    `;
    document.head.appendChild(style);
}

// Translate common error messages from Indonesian to English
function translateErrorMessage(message) {
    const translations = {
        'Gagal memproses response dari server': 'Failed to process server response',
        'Terjadi kesalahan pada server': 'An error occurred on the server',
        'Permintaan tidak valid': 'Invalid request',
        'Data tidak ditemukan': 'Data not found',
        'Akses ditolak': 'Access denied',
        'Terlalu banyak permintaan': 'Too many requests',
        'Koneksi ke server gagal': 'Failed to connect to server',
        'Timeout saat menghubungi server': 'Server connection timeout'
    };
    
    // Return translated message if found, otherwise return original
    return translations[message] || message;
}

// Show error message in the leaderboard
function showError(message, isFinal = false) {
    const leaderboardBody = document.getElementById('leaderboard-body');
    if (!leaderboardBody) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    
    leaderboardBody.innerHTML = `
        <tr>
            <td colspan="4" class="error-message">
                <div class="error-content">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-triangle">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <h4>Leaderboard Unavailable</h4>
                    <div class="error-message-text">${message}</div>
                    ${isFinal ? '' : `
                        <button onclick="updateLeaderboard()" class="retry-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-refresh-cw">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            Try Again
                        </button>
                    `}
                    <p class="last-updated">Last updated: ${timeString} - ${dateString}</p>
                    ${isFinal ? `
                        <p class="refresh-hint">
                            <small>Please refresh the page to try again</small>
                        </p>
                    ` : ''}
                </div>
            </td>
        </tr>`;
}

// JavaScript for Rust Magic Leaderboard
document.addEventListener('DOMContentLoaded', function() {
    // Set the end date for the countdown (August 14, 2025 23:59:59 EST)
    const endDate = new Date('August 15, 2025 00:00:00 GMT-0400').getTime();
    
    // Update the countdown every second
    const countdown = setInterval(function() {
        const now = new Date().getTime();
        const distance = endDate - now;
        
        // Calculate time units
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        // Display the countdown
        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
        
        // If the countdown is over, clear the interval
        if (distance < 0) {
            clearInterval(countdown);
            document.querySelector('.countdown-timer').innerHTML = '<h3>Leaderboard has ended!</h3>';
        }
    }, 1000);
    
    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Toggle live stream container
    const streamContainer = document.querySelector('.live-stream-container');
    const streamToggle = document.querySelector('.stream-toggle');

    if (streamContainer && streamToggle) {
        streamToggle.addEventListener('click', function() {
            streamContainer.classList.toggle('collapsed');
        });
    }
    
        // Initialize the leaderboard
    updateLeaderboard();
});
