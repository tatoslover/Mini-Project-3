const mongoose = require("mongoose");

// MongoDB Atlas connection string
const MONGODB_URI =
  "mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio";

async function testMongoDBConnection() {
  console.log("🧪 Testing MongoDB Atlas Connection...\n");

  try {
    console.log("📡 Connecting to MongoDB Atlas...");

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ Successfully connected to MongoDB Atlas!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`🔌 Port: ${mongoose.connection.port}`);
    console.log(`📈 Ready State: ${mongoose.connection.readyState}`);

    // Test database operations
    console.log("\n🔍 Testing database operations...");

    // Test collection creation and basic operations
    const testCollection = mongoose.connection.db.collection("connection_test");

    // Insert a test document
    const testDoc = {
      timestamp: new Date(),
      test: "MongoDB connection successful",
      environment: "development",
      user: "samuelwelove",
    };

    const insertResult = await testCollection.insertOne(testDoc);
    console.log("✅ Test document inserted with ID:", insertResult.insertedId);

    // Read the test document
    const foundDoc = await testCollection.findOne({
      _id: insertResult.insertedId,
    });
    console.log("✅ Test document retrieved:", foundDoc.test);

    // Update the test document
    await testCollection.updateOne(
      { _id: insertResult.insertedId },
      { $set: { updated: true, updateTime: new Date() } },
    );
    console.log("✅ Test document updated successfully");

    // Delete the test document
    await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log("✅ Test document deleted successfully");

    // Test collections that will be used by the app
    console.log("\n📋 Checking application collections...");

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(`📦 Total collections: ${collections.length}`);

    const appCollections = [
      "users",
      "favoriteimages",
      "apiusages",
      "breedcaches",
      "serverstats",
      "errorlogs",
    ];

    for (const collectionName of appCollections) {
      const exists = collections.some((col) => col.name === collectionName);
      console.log(
        `${exists ? "✅" : "⚠️"} Collection '${collectionName}': ${exists ? "exists" : "will be created on first use"}`,
      );
    }

    // Test indexes
    console.log("\n🔍 Checking database indexes...");

    try {
      const usersIndexes = await mongoose.connection.db
        .collection("users")
        .indexes();
      console.log(`✅ Users collection indexes: ${usersIndexes.length}`);
    } catch (error) {
      console.log("⚠️ Users collection not yet created");
    }

    // Performance test
    console.log("\n⚡ Performance test...");
    const startTime = Date.now();

    // Perform 10 simple operations
    const perfTestCollection = mongoose.connection.db.collection("perf_test");
    const perfPromises = [];

    for (let i = 0; i < 10; i++) {
      perfPromises.push(
        perfTestCollection.insertOne({
          index: i,
          timestamp: new Date(),
          data: `Performance test document ${i}`,
        }),
      );
    }

    await Promise.all(perfPromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `✅ Inserted 10 documents in ${duration}ms (avg: ${duration / 10}ms per operation)`,
    );

    // Cleanup performance test documents
    await perfTestCollection.deleteMany({ index: { $exists: true } });
    console.log("✅ Performance test cleanup completed");

    console.log("\n🎉 MongoDB Atlas connection test completed successfully!");
    console.log("\n📋 Connection Summary:");
    console.log(`   • Database: puphub`);
    console.log(`   • Cluster: IODMP3Portfolio`);
    console.log(`   • User: samuelwelove`);
    console.log(`   • Status: Ready for production deployment`);
  } catch (error) {
    console.error("❌ MongoDB connection test failed:");
    console.error("Error:", error.message);

    if (error.name === "MongoNetworkError") {
      console.error("\n🔧 Troubleshooting tips:");
      console.error("   • Check your internet connection");
      console.error("   • Verify the connection string is correct");
      console.error("   • Ensure your IP address is whitelisted in Atlas");
      console.error("   • Check if the database user has proper permissions");
    } else if (error.name === "MongoServerError") {
      console.error("\n🔧 Server error troubleshooting:");
      console.error("   • Check database user credentials");
      console.error("   • Verify database permissions");
      console.error("   • Check cluster status in Atlas dashboard");
    }

    process.exit(1);
  } finally {
    // Close the connection
    try {
      await mongoose.connection.close();
      console.log("\n🔌 MongoDB connection closed");
    } catch (error) {
      console.error("Error closing connection:", error.message);
    }
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, closing MongoDB connection...");
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed successfully");
  } catch (error) {
    console.error("Error during cleanup:", error.message);
  }
  process.exit(0);
});

// Run the test
testMongoDBConnection().catch(console.error);
