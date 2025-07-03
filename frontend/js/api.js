// API Configuration
const API_BASE_URL = 'http://localhost:3000';
const API_ENDPOINTS = {
    health: '/api/health',
    users: '/api/users',
    posts: '/api/posts',
    comments: '/api/comments',
    syncAll: '/api/sync/all',
    syncUsers: '/api/users/sync',
    syncPosts: '/api/posts/sync',
    syncComments: '/api/comments/sync'
};

// API Helper Class
class APIClient {
    constructor(baseURL = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    // Generic fetch method with error handling
    async fetch(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);

            const response = await fetch(url, config);
            const data = await response.json();

            console.log(`📊 API Response:`, {
                status: response.status,
                statusText: response.statusText,
                data: data
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${data.message || response.statusText}`);
            }

            return {
                success: true,
                status: response.status,
                data: data,
                response: response
            };
        } catch (error) {
            console.error('❌ API Error:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    // Health check
    async checkHealth() {
        return await this.fetch(API_ENDPOINTS.health);
    }

    // User operations
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${API_ENDPOINTS.users}?${queryString}` : API_ENDPOINTS.users;
        return await this.fetch(endpoint);
    }

    async createUser(userData) {
        return await this.fetch(API_ENDPOINTS.users, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getUserById(id) {
        return await this.fetch(`${API_ENDPOINTS.users}/${id}`);
    }

    async updateUser(id, userData) {
        return await this.fetch(`${API_ENDPOINTS.users}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(id) {
        return await this.fetch(`${API_ENDPOINTS.users}/${id}`, {
            method: 'DELETE'
        });
    }

    async syncUsers() {
        return await this.fetch(API_ENDPOINTS.syncUsers, {
            method: 'POST'
        });
    }

    // Post operations
    async getPosts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${API_ENDPOINTS.posts}?${queryString}` : API_ENDPOINTS.posts;
        return await this.fetch(endpoint);
    }

    async createPost(postData) {
        return await this.fetch(API_ENDPOINTS.posts, {
            method: 'POST',
            body: JSON.stringify(postData)
        });
    }

    async getPostById(id) {
        return await this.fetch(`${API_ENDPOINTS.posts}/${id}`);
    }

    async updatePost(id, postData) {
        return await this.fetch(`${API_ENDPOINTS.posts}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(postData)
        });
    }

    async deletePost(id) {
        return await this.fetch(`${API_ENDPOINTS.posts}/${id}`, {
            method: 'DELETE'
        });
    }

    async getPostsByUser(userId) {
        return await this.fetch(`${API_ENDPOINTS.posts}/user/${userId}`);
    }

    async syncPosts() {
        return await this.fetch(API_ENDPOINTS.syncPosts, {
            method: 'POST'
        });
    }

    // Comment operations
    async getComments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${API_ENDPOINTS.comments}?${queryString}` : API_ENDPOINTS.comments;
        return await this.fetch(endpoint);
    }

    async createComment(commentData) {
        return await this.fetch(API_ENDPOINTS.comments, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    async getCommentById(id) {
        return await this.fetch(`${API_ENDPOINTS.comments}/${id}`);
    }

    async updateComment(id, commentData) {
        return await this.fetch(`${API_ENDPOINTS.comments}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(commentData)
        });
    }

    async deleteComment(id) {
        return await this.fetch(`${API_ENDPOINTS.comments}/${id}`, {
            method: 'DELETE'
        });
    }

    async getCommentsByPost(postId) {
        return await this.fetch(`${API_ENDPOINTS.comments}/post/${postId}`);
    }

    async syncComments() {
        return await this.fetch(API_ENDPOINTS.syncComments, {
            method: 'POST'
        });
    }

    // Sync operations
    async syncAll() {
        return await this.fetch(API_ENDPOINTS.syncAll, {
            method: 'POST'
        });
    }
}

// Create global API client instance
const apiClient = new APIClient();

// Helper functions for UI
function formatResponse(response) {
    if (response.success) {
        return JSON.stringify(response.data, null, 2);
    } else {
        return `Error: ${response.error}`;
    }
}

function formatResponseForDisplay(response) {
    const timestamp = new Date().toLocaleTimeString();

    if (response.success) {
        return {
            success: true,
            timestamp: timestamp,
            status: response.status,
            formattedData: JSON.stringify(response.data, null, 2)
        };
    } else {
        return {
            success: false,
            timestamp: timestamp,
            error: response.error,
            formattedData: `❌ Error: ${response.error}`
        };
    }
}

// API status checker
async function checkAPIStatus() {
    const statusElement = document.querySelector('.status-text');
    const iconElement = document.querySelector('.fa-circle');

    if (statusElement) {
        statusElement.textContent = 'Checking...';
    }

    const result = await apiClient.checkHealth();

    if (statusElement && iconElement) {
        if (result.success) {
            statusElement.textContent = 'Online';
            iconElement.className = 'fas fa-circle text-success me-2';
        } else {
            statusElement.textContent = 'Offline';
            iconElement.className = 'fas fa-circle text-danger me-2';
        }
    }

    return result;
}

// Test endpoint function for UI
async function testEndpoint(endpoint, method = 'GET', data = null) {
    const responseElement = document.getElementById('apiResponse');

    if (responseElement) {
        responseElement.innerHTML = `
            <div class="text-center">
                <div class="loading"></div>
                <p class="mt-2">Testing ${method} ${endpoint}...</p>
            </div>
        `;
    }

    let result;
    try {
        if (method === 'POST' && data) {
            result = await apiClient.fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } else if (method === 'POST') {
            result = await apiClient.fetch(endpoint, {
                method: 'POST'
            });
        } else {
            result = await apiClient.fetch(endpoint);
        }
    } catch (error) {
        result = {
            success: false,
            error: error.message
        };
    }

    const displayResult = formatResponseForDisplay(result);

    if (responseElement) {
        const statusClass = displayResult.success ? 'text-success' : 'text-danger';
        const statusIcon = displayResult.success ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle';

        responseElement.innerHTML = `
            <div class="mb-3">
                <strong class="${statusClass}">
                    <i class="${statusIcon} me-2"></i>
                    ${displayResult.success ? 'Success' : 'Error'}
                </strong>
                <small class="text-muted ms-3">${displayResult.timestamp}</small>
            </div>
            <pre class="mb-0">${displayResult.formattedData}</pre>
        `;
    }

    return result;
}

// Data statistics helper
async function getDataStatistics() {
    const stats = {
        users: 0,
        posts: 0,
        comments: 0,
        error: null
    };

    try {
        const [usersResult, postsResult, commentsResult] = await Promise.all([
            apiClient.getUsers({ limit: 1 }),
            apiClient.getPosts({ limit: 1 }),
            apiClient.getComments({ limit: 1 })
        ]);

        if (usersResult.success && usersResult.data && usersResult.data.pagination) {
            stats.users = usersResult.data.pagination.total || 0;
        }

        if (postsResult.success && postsResult.data && postsResult.data.pagination) {
            stats.posts = postsResult.data.pagination.total || 0;
        }

        if (commentsResult.success && commentsResult.data && commentsResult.data.pagination) {
            stats.comments = commentsResult.data.pagination.total || 0;
        }
    } catch (error) {
        console.error('Error fetching statistics:', error);
        stats.error = error.message;
    }

    return stats;
}

// Sample data generators
function generateSampleUser() {
    const names = ['John Doe', 'Jane Smith', 'Alice Johnson', 'Bob Wilson', 'Carol Brown'];
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const username = randomName.toLowerCase().replace(' ', '');
    const domain = domains[Math.floor(Math.random() * domains.length)];

    return {
        name: randomName,
        username: username,
        email: `${username}@${domain}`,
        phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
        website: `${username}.${domain}`,
        address: {
            street: `${Math.floor(Math.random() * 999) + 1} Main St`,
            suite: `Apt ${Math.floor(Math.random() * 99) + 1}`,
            city: 'Anytown',
            zipcode: `${Math.floor(Math.random() * 90000) + 10000}`,
            geo: {
                lat: (Math.random() * 180 - 90).toFixed(6),
                lng: (Math.random() * 360 - 180).toFixed(6)
            }
        },
        company: {
            name: `${randomName.split(' ')[0]} Industries`,
            catchPhrase: 'Innovation through dedication',
            bs: 'synergistic solutions'
        }
    };
}

function generateSamplePost() {
    const titles = [
        'Understanding Modern Web Development',
        'The Future of Database Technology',
        'Building Scalable APIs',
        'Best Practices for Full-Stack Development',
        'Introduction to Backend Architecture'
    ];

    const bodies = [
        'This post explores the latest trends and technologies in modern web development...',
        'Database technology continues to evolve rapidly, with new solutions emerging...',
        'Creating scalable APIs requires careful consideration of architecture and design...',
        'Full-stack development involves many moving parts that must work together...',
        'Backend architecture forms the foundation of any robust web application...'
    ];

    const tags = ['web', 'development', 'api', 'database', 'backend', 'frontend', 'javascript', 'node.js'];
    const categories = ['tutorial', 'guide', 'opinion', 'news', 'review'];

    return {
        title: titles[Math.floor(Math.random() * titles.length)],
        body: bodies[Math.floor(Math.random() * bodies.length)],
        tags: tags.slice(0, Math.floor(Math.random() * 3) + 2),
        category: categories[Math.floor(Math.random() * categories.length)],
        status: 'published'
    };
}

function generateSampleComment() {
    const names = ['Alex Thompson', 'Sarah Davis', 'Mike Rodriguez', 'Emma White', 'Chris Lee'];
    const comments = [
        'Great post! Very informative and well-written.',
        'Thanks for sharing this. It really helped me understand the concept.',
        'I have a different perspective on this topic...',
        'This is exactly what I was looking for. Much appreciated!',
        'Could you elaborate more on this point?'
    ];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const email = `${randomName.toLowerCase().replace(' ', '.')}@email.com`;

    return {
        name: randomName,
        email: email,
        body: comments[Math.floor(Math.random() * comments.length)]
    };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        apiClient,
        checkAPIStatus,
        testEndpoint,
        getDataStatistics,
        generateSampleUser,
        generateSamplePost,
        generateSampleComment,
        formatResponse,
        formatResponseForDisplay
    };
}
