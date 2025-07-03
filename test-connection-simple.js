const mongoose = require("mongoose");

// MongoDB Atlas connection string - replace with your actual connection string
const MONGODB_URI = "mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio";

async function testConnection() {
  console.log("🧪 Testing MongoDB Atlas Connection...\n");

  try {
    console.log("📡 Connecting to MongoDB Atlas...");

    // Connect with minimal options
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ Successfully connected to MongoDB Atlas!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`📈 Connection State: ${mongoose.connection.readyState}`);

    // Test a simple operation
    console.log("\n🔍 Testing database operation...");

    const testCollection = mongoose.connection.db.collection("connection_test");

    // Insert a test document
    const testDoc = {
      timestamp: new Date(),
      test: "Connection successful",
      ip: "119.224.12.59"
    };

    const result = await testCollection.insertOne(testDoc);
    console.log("✅ Test document inserted:", result.insertedId);

    // Read it back
    const found = await testCollection.findOne({ _id: result.insertedId });
    console.log("✅ Test document retrieved:", found.test);

    // Clean up
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log("✅ Test document cleaned up");

    console.log("\n🎉 MongoDB connection test PASSED!");

  } catch (error) {
    console.error("❌ MongoDB connection test FAILED:");
    console.error("Error:", error.message);

    if (error.message.includes("IP")) {
      console.error("\n🔧 IP Whitelist Issue:");
      console.error("   • Your IP (119.224.12.59) needs to be whitelisted in MongoDB Atlas");
      console.error("   • Go to Network Access in Atlas and add your IP");
      console.error("   • Or allow access from anywhere (0.0.0.0/0) for testing");
    }

    if (error.message.includes("authentication")) {
      console.error("\n🔧 Authentication Issue:");
      console.error("   • Check your username and password");
      console.error("   • Ensure the database user has proper permissions");
    }

    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log("\n🔌 Connection closed");
  }
}

// Run the test
testConnection().catch(console.error);
