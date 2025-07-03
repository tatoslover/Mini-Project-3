# Barkend API - Backend Documentation

🐕 A comprehensive RESTful API for dog breed information and images, built with Express.js and integrated with the Dog CEO API.

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- npm 6+

### Installation & Setup
```bash
# Clone and navigate to project
git clone <repository-url>
cd Mini-Project-3

# Install dependencies
npm install

# Start the server
npm start
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Interactive Documentation
- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **OpenAPI Spec**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

### Quick Reference
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/breeds` | GET | List all dog breeds |
| `/api/random` | GET | Get random dog images |
| `/api/breeds/{breed}/images` | GET | Get breed-specific images |
| `/api/breeds/{breed}/random` | GET | Get random breed images |
| `/api/favorites` | GET/POST | Manage favorite images |
| `/api/favorites/{id}` | DELETE | Remove favorite |
| `/api/stats` | GET | Server statistics |
| `/api/search` | GET | Search breeds |

## 🏗️ Architecture Overview

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **HTTP Client**: Axios
- **Documentation**: Swagger/OpenAPI
- **External API**: Dog CEO API

### System Components

```
┌─────────────────┐
│   Frontend      │ ← Static HTML/CSS/JS
├─────────────────┤
│   Express.js    │ ← API Routes & Middleware
├─────────────────┤
│ Business Logic  │ ← Data Processing & Caching
├─────────────────┤
│  Dog CEO API    │ ← External Data Source
└─────────────────┘
```

### Data Flow
1. **Request** → Express middleware stack
2. **Processing** → Business logic & validation  
3. **External API** → Dog CEO API integration
4. **Caching** → In-memory breed data storage
5. **Response** → JSON formatted response

## 🛠️ Implementation Details

### Core Features

#### 🔧 Middleware Stack
```javascript
app.use(cors());                    // Enable CORS
app.use(express.json());            // Parse JSON bodies
app.use(express.static('frontend')); // Serve static files
app.use(logRequest);                // Custom logging
```

#### 📊 In-Memory Storage
```javascript
let breedCache = {};           // Cached breed data
let favoriteImages = [];       // User favorites
let userStats = {              // Server statistics
  imagesServed: 0,
  breedsViewed: 0,
  favoritesCount: 0,
  serverStartTime: Date.now()
};
```

#### 🔄 Async/Await Pattern
- Modern promise-based API calls
- Comprehensive error handling
- Graceful external API failure handling

#### 📝 Request Logging
- Timestamped request logging
- Method and path tracking
- Development debugging support

## 🎯 Key Endpoints

### Health Check
```http
GET /api/health
```
Returns server status, uptime, and basic statistics.

### Get All Breeds
```http
GET /api/breeds
```
Retrieves formatted list of all dog breeds with sub-breeds.

### Random Dog Images
```http
GET /api/random?count=5
```
Returns random dog images (max 50 per request).

### Breed-Specific Images
```http
GET /api/breeds/golden-retriever/images?count=10
```
Gets images for specific breed (supports sub-breeds with hyphen notation).

### Search Breeds
```http
GET /api/search?q=golden
```
Search breeds by name (minimum 2 characters).

## 🔧 Configuration

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=development         # Environment mode
```

### External API
- **Base URL**: `https://dog.ceo/api`
- **Rate Limiting**: Built-in request limiting (max 50 images)
- **Error Handling**: Graceful fallbacks for API failures

## 📈 Performance & Optimization

### Caching Strategy
- **Breed Data**: Cached on first request
- **Response Limiting**: Max 50 images per request
- **In-Memory Storage**: Fast access for frequently used data

### Error Handling
- **HTTP Status Codes**: Proper status code usage
- **Error Messages**: Descriptive user-friendly messages
- **Logging**: Comprehensive error logging for debugging

### Security Considerations
- **CORS Enabled**: Cross-origin resource sharing
- **Input Validation**: Query parameter validation
- **Rate Limiting**: Built-in request limiting

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Get breeds
curl http://localhost:3000/api/breeds

# Random dog
curl http://localhost:3000/api/random

# Search breeds
curl "http://localhost:3000/api/search?q=golden"
```

### Using Swagger UI
1. Start the server: `npm start`
2. Open browser: `http://localhost:3000/api-docs`
3. Test endpoints interactively

## 📊 Monitoring & Statistics

### Available Metrics
- **Images Served**: Total images delivered
- **Breeds Viewed**: Number of breed queries
- **Favorites Count**: User favorite images
- **Server Uptime**: Server running time
- **API Response Times**: External API performance

### Statistics Endpoint
```http
GET /api/stats
```
Returns comprehensive server statistics and metrics.

## 🚀 Deployment

### Development
```bash
npm run dev          # Start with nodemon
npm start           # Start production server
```

### Production Considerations
- **Environment Variables**: Set NODE_ENV=production
- **Process Management**: Use PM2 or similar
- **Reverse Proxy**: Nginx/Apache for static files
- **Database**: Consider persistent storage for favorites
- **Monitoring**: Add application monitoring (New Relic, etc.)

## 🤝 Contributing

### Code Style
- **Prettier**: Code formatting
- **ESLint**: Code linting
- **Naming**: Descriptive variable and function names

### API Design Principles
- **RESTful**: Follow REST conventions
- **Consistent**: Uniform response format
- **Documented**: Comprehensive Swagger documentation
- **Error Handling**: Graceful error responses

## 📝 License

MIT License - see LICENSE file for details.

## 🐾 Fun Facts

- 🐕 Supports 98+ dog breeds
- 📸 Can serve up to 50 images per request
- 🔍 Fuzzy search for breed names
- ❤️ Favorite management system
- 📊 Real-time statistics tracking
- 🔄 Automatic breed data caching
- 🌐 Full CORS support for web apps

---

**Built with ❤️ for learning backend development and API design patterns.**