// Main Application Logic for Mini Project 3 Frontend

// Global state
let currentPage = 'home';
let dataChart = null;
let apiStatus = false;

// DOM Elements
const navLinks = {
    home: document.getElementById('navHome'),
    backend: document.getElementById('navBackend'),
    api: document.getElementById('navAPI'),
    data: document.getElementById('navData')
};

const pageElements = {
    home: document.getElementById('home-page'),
    backend: document.getElementById('backend-page'),
    api: document.getElementById('api-page'),
    data: document.getElementById('data-page')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Mini Project 3 Frontend Initialized');

    // Hide loader after delay
    setTimeout(() => {
        const loader = document.getElementById('apiLoader');
        if (loader) {
            loader.classList.add('hide');
        }
    }, 2000);

    // Initialize navigation
    initializeNavigation();

    // Check API status on load
    checkAPIStatus();

    // Initialize data charts
    initializeDataCharts();

    // Set up periodic API status check
    setInterval(checkAPIStatus, 30000); // Check every 30 seconds

    // Load initial data for data explorer
    loadDataExplorer();

    console.log('✅ Application initialization complete');
});

// Navigation Management
function initializeNavigation() {
    Object.keys(navLinks).forEach(page => {
        const link = navLinks[page];
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPage(page);
            });
        }
    });
}

function showPage(pageName) {
    // Update active nav link
    Object.keys(navLinks).forEach(page => {
        const link = navLinks[page];
        if (link) {
            if (page === pageName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });

    // Show/hide page sections
    Object.keys(pageElements).forEach(page => {
        const element = pageElements[page];
        if (element) {
            if (page === pageName) {
                element.classList.add('active');
                element.style.display = 'block';
            } else {
                element.classList.remove('active');
                element.style.display = 'none';
            }
        }
    });

    currentPage = pageName;

    // Load page-specific data
    switch (pageName) {
        case 'data':
            loadDataExplorer();
            break;
        case 'api':
            clearAPIResponse();
            break;
    }

    console.log(`📄 Switched to page: ${pageName}`);
}

// API Status Management
async function checkAPIStatus() {
    try {
        const result = await apiClient.checkHealth();
        apiStatus = result.success;

        updateAPIStatusDisplay(result.success);
        return result;
    } catch (error) {
        console.error('❌ API Status Check Failed:', error);
        apiStatus = false;
        updateAPIStatusDisplay(false);
    }
}

function updateAPIStatusDisplay(isOnline) {
    const statusText = document.querySelector('.status-text');
    const statusIcon = document.querySelector('.fa-circle');

    if (statusText && statusIcon) {
        if (isOnline) {
            statusText.textContent = 'Online';
            statusIcon.className = 'fas fa-circle text-success me-2';
        } else {
            statusText.textContent = 'Offline';
            statusIcon.className = 'fas fa-circle text-danger me-2';
        }
    }
}

// Data Explorer Functions
async function loadDataExplorer() {
    if (currentPage !== 'data') return;

    console.log('📊 Loading Data Explorer...');

    // Load statistics
    await loadDataStatistics();

    // Load recent data
    await loadRecentData();

    // Update chart
    await updateDataChart();
}

async function loadDataStatistics() {
    try {
        const stats = await getDataStatistics();

        // Update counters with animation
        animateCounter('userCount', stats.users);
        animateCounter('postCount', stats.posts);
        animateCounter('commentCount', stats.comments);

    } catch (error) {
        console.error('❌ Error loading statistics:', error);
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;
    const increment = Math.ceil((targetValue - currentValue) / 20);
    let current = currentValue;

    const timer = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(timer);
        }
        element.textContent = current;
    }, 50);
}

async function loadRecentData() {
    try {
        // Load recent users
        const usersResult = await apiClient.getUsers({ limit: 5, sort: 'createdAt', order: 'desc' });
        if (usersResult.success) {
            displayRecentUsers(usersResult.data.data || []);
        }

        // Load recent posts
        const postsResult = await apiClient.getPosts({ limit: 5, sort: 'createdAt', order: 'desc' });
        if (postsResult.success) {
            displayRecentPosts(postsResult.data.data || []);
        }

    } catch (error) {
        console.error('❌ Error loading recent data:', error);
    }
}

function displayRecentUsers(users) {
    const container = document.getElementById('recentUsers');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-users fa-2x mb-2"></i>
                <p>No users found. Try syncing data first.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="data-item">
            <div class="data-item-title">${user.name || 'Unknown User'}</div>
            <div class="data-item-text">
                <i class="fas fa-envelope me-1"></i>${user.email || 'No email'}
            </div>
        </div>
    `).join('');
}

function displayRecentPosts(posts) {
    const container = document.getElementById('recentPosts');
    if (!container) return;

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-newspaper fa-2x mb-2"></i>
                <p>No posts found. Try syncing data first.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="data-item">
            <div class="data-item-title">${post.title || 'Untitled Post'}</div>
            <div class="data-item-text">
                ${post.body ? post.body.substring(0, 60) + '...' : 'No content'}
            </div>
        </div>
    `).join('');
}

// Chart Management
function initializeDataCharts() {
    const canvas = document.getElementById('dataChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    dataChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Users', 'Posts', 'Comments'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#0d6efd',
                    '#198754',
                    '#ffc107'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Data Distribution'
                }
            }
        }
    });
}

async function updateDataChart() {
    if (!dataChart) return;

    try {
        const stats = await getDataStatistics();

        dataChart.data.datasets[0].data = [
            stats.users,
            stats.posts,
            stats.comments
        ];

        dataChart.update();
    } catch (error) {
        console.error('❌ Error updating chart:', error);
    }
}

// API Demo Functions
function clearAPIResponse() {
    const responseElement = document.getElementById('apiResponse');
    if (responseElement) {
        responseElement.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-mouse-pointer fa-2x mb-3"></i>
                <p>Click any API button above to see the response here</p>
            </div>
        `;
    }
}

// Modal Management
function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    modal.show();
}

function showCreatePostModal() {
    const modal = new bootstrap.Modal(document.getElementById('createPostModal'));
    modal.show();
}

function showCreateCommentModal() {
    const modal = new bootstrap.Modal(document.getElementById('createCommentModal'));
    modal.show();
}

// Create Functions
async function createUser() {
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const phone = document.getElementById('userPhone').value;

    if (!name || !email) {
        alert('Please fill in all required fields');
        return;
    }

    const userData = generateSampleUser();
    userData.name = name;
    userData.email = email;
    userData.username = email.split('@')[0];
    if (phone) userData.phone = phone;

    try {
        const result = await apiClient.createUser(userData);

        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
            modal.hide();

            // Clear form
            document.getElementById('createUserForm').reset();

            // Show success and update display
            await testEndpoint('/api/users', 'POST', userData);

            // Refresh data if on data page
            if (currentPage === 'data') {
                loadDataExplorer();
            }
        } else {
            alert(`Error creating user: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function createPost() {
    const title = document.getElementById('postTitle').value;
    const body = document.getElementById('postBody').value;

    if (!title || !body) {
        alert('Please fill in all required fields');
        return;
    }

    const postData = {
        title: title,
        body: body,
        category: 'general',
        status: 'published'
    };

    try {
        const result = await apiClient.createPost(postData);

        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createPostModal'));
            modal.hide();

            // Clear form
            document.getElementById('createPostForm').reset();

            // Show success and update display
            await testEndpoint('/api/posts', 'POST', postData);

            // Refresh data if on data page
            if (currentPage === 'data') {
                loadDataExplorer();
            }
        } else {
            alert(`Error creating post: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function createComment() {
    const name = document.getElementById('commentName').value;
    const email = document.getElementById('commentEmail').value;
    const body = document.getElementById('commentBody').value;

    if (!name || !email || !body) {
        alert('Please fill in all required fields');
        return;
    }

    // Get first post for demo purposes
    const postsResult = await apiClient.getPosts({ limit: 1 });
    let postId = '1'; // Default fallback

    if (postsResult.success && postsResult.data.data && postsResult.data.data.length > 0) {
        postId = postsResult.data.data[0]._id || postsResult.data.data[0].id || '1';
    }

    const commentData = {
        postId: postId,
        name: name,
        email: email,
        body: body
    };

    try {
        const result = await apiClient.createComment(commentData);

        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createCommentModal'));
            modal.hide();

            // Clear form
            document.getElementById('createCommentForm').reset();

            // Show success and update display
            await testEndpoint('/api/comments', 'POST', commentData);

            // Refresh data if on data page
            if (currentPage === 'data') {
                loadDataExplorer();
            }
        } else {
            alert(`Error creating comment: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Sync Functions
async function syncAllData() {
    const responseElement = document.getElementById('apiResponse');

    if (responseElement) {
        responseElement.innerHTML = `
            <div class="text-center">
                <div class="loading"></div>
                <p class="mt-2">Syncing all data from external API...</p>
                <small class="text-muted">This may take a few moments</small>
            </div>
        `;
    }

    try {
        const result = await apiClient.syncAll();

        const displayResult = formatResponseForDisplay(result);

        if (responseElement) {
            const statusClass = displayResult.success ? 'text-success' : 'text-danger';
            const statusIcon = displayResult.success ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';

            responseElement.innerHTML = `
                <div class="mb-3">
                    <strong class="${statusClass}">
                        <i class="${statusIcon} me-2"></i>
                        ${displayResult.success ? 'Sync Completed' : 'Sync Failed'}
                    </strong>
                    <small class="text-muted ms-3">${displayResult.timestamp}</small>
                </div>
                <pre class="mb-0">${displayResult.formattedData}</pre>
            `;
        }

        // Refresh data explorer if on data page
        if (currentPage === 'data' && result.success) {
            setTimeout(() => {
                loadDataExplorer();
            }, 1000);
        }

        return result;
    } catch (error) {
        console.error('❌ Sync failed:', error);

        if (responseElement) {
            responseElement.innerHTML = `
                <div class="text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Sync Failed</strong>
                </div>
                <pre class="mt-2">Error: ${error.message}</pre>
            `;
        }
    }
}

// Utility Functions
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Error Handling
window.addEventListener('error', function(e) {
    console.error('🚨 Global Error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('🚨 Unhandled Promise Rejection:', e.reason);
});

// Export functions for global access
window.showPage = showPage;
window.checkAPIStatus = checkAPIStatus;
window.testEndpoint = testEndpoint;
window.syncAllData = syncAllData;
window.showCreateUserModal = showCreateUserModal;
window.showCreatePostModal = showCreatePostModal;
window.showCreateCommentModal = showCreateCommentModal;
window.createUser = createUser;
window.createPost = createPost;
window.createComment = createComment;

console.log('📱 App.js loaded successfully');
