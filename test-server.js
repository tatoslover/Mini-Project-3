const axios = require('axios');

async function testServer() {
    const PORT = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${PORT}`;

    console.log('🧪 Testing PupHub API Server...\n');

    // Test health endpoint
    try {
        console.log('Testing health endpoint...');
        const healthResponse = await axios.get(`${baseUrl}/api/health`);
        console.log('✅ Health check passed');
        console.log(`   Status: ${healthResponse.data.status}`);
        console.log(`   Service: ${healthResponse.data.service}`);
        console.log(`   Uptime: ${healthResponse.data.uptime}\n`);
    } catch (error) {
        console.log('❌ Health check failed');
        console.log(`   Error: ${error.message}\n`);
        return;
    }

    // Test breeds endpoint
    try {
        console.log('Testing breeds endpoint...');
        const breedsResponse = await axios.get(`${baseUrl}/api/breeds`);
        console.log('✅ Breeds endpoint passed');
        console.log(`   Total breeds: ${breedsResponse.data.count}`);
        console.log(`   Sample breed: ${breedsResponse.data.data[0]?.displayName}\n`);
    } catch (error) {
        console.log('❌ Breeds endpoint failed');
        console.log(`   Error: ${error.message}\n`);
    }

    // Test random dog endpoint
    try {
        console.log('Testing random dog endpoint...');
        const randomResponse = await axios.get(`${baseUrl}/api/random`);
        console.log('✅ Random dog endpoint passed');
        console.log(`   Image URL: ${randomResponse.data.data.url?.substring(0, 50)}...\n`);
    } catch (error) {
        console.log('❌ Random dog endpoint failed');
        console.log(`   Error: ${error.message}\n`);
    }

    // Test stats endpoint
    try {
        console.log('Testing stats endpoint...');
        const statsResponse = await axios.get(`${baseUrl}/api/stats`);
        console.log('✅ Stats endpoint passed');
        console.log(`   Images served: ${statsResponse.data.data.imagesServed}`);
        console.log(`   Breeds viewed: ${statsResponse.data.data.breedsViewed}\n`);
    } catch (error) {
        console.log('❌ Stats endpoint failed');
        console.log(`   Error: ${error.message}\n`);
    }

    // Test documentation endpoints
    try {
        console.log('Testing documentation endpoints...');
        const docsResponse = await axios.get(`${baseUrl}/api-docs.json`);
        console.log('✅ API documentation available');
        console.log(`   OpenAPI version: ${docsResponse.data.openapi}`);
        console.log(`   API title: ${docsResponse.data.info.title}\n`);
    } catch (error) {
        console.log('❌ Documentation endpoint failed');
        console.log(`   Error: ${error.message}\n`);
    }

    console.log('🎉 Testing complete!');
    console.log(`📚 View full documentation at: ${baseUrl}/api-docs`);
    console.log(`🏠 Visit homepage at: ${baseUrl}`);
}

// Run tests
testServer().catch(console.error);
