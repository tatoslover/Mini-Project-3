const { spawn } = require("child_process");
const path = require("path");

// Set environment variables for testing
process.env.MONGODB_URI =
  "mongodb+srv://samuelwelove:vnIsLznxJuBWeznE@iodmp3portfolio.2sjhs9u.mongodb.net/puphub?retryWrites=true&w=majority&appName=IODMP3Portfolio";
process.env.NODE_ENV = "development";
process.env.DOG_API_BASE = "https://dog.ceo/api";
process.env.DEPLOY_TIME = "1706875200000";
process.env.ENABLE_ANALYTICS = "true";
process.env.LOG_LEVEL = "debug";

const testFunctions = async () => {
  console.log("🧪 Testing Barkend Netlify Functions Locally...\n");

  const functions = ["health", "breeds", "random", "stats", "swagger-spec"];

  for (const functionName of functions) {
    console.log(`\n🔍 Testing ${functionName} function...`);

    try {
      // Import the function
      const functionPath = path.join(
        __dirname,
        "netlify",
        "functions",
        `${functionName}.js`,
      );
      const { handler } = require(functionPath);

      // Create mock event and context
      const mockEvent = {
        httpMethod: "GET",
        path: `/.netlify/functions/${functionName}`,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Test)",
        },
        queryStringParameters: {},
        body: null,
        isBase64Encoded: false,
      };

      const mockContext = {
        functionName: functionName,
        functionVersion: "1.0.0",
        invokedFunctionArn:
          "arn:aws:lambda:us-east-1:123456789012:function:test",
        memoryLimitInMB: "128",
        remainingTimeInMillis: 30000,
      };

      // Test the function
      const startTime = Date.now();
      const result = await handler(mockEvent, mockContext);
      const duration = Date.now() - startTime;

      console.log(`✅ ${functionName} function - Status: ${result.statusCode}`);
      console.log(`⏱️  Response time: ${duration}ms`);

      // Parse and display response
      try {
        const response = JSON.parse(result.body);
        if (functionName === "health") {
          console.log(`📊 Health status: ${response.status}`);
          console.log(
            `🗄️  Database: ${response.database?.status || "unknown"}`,
          );
          console.log(`🐕 Service: ${response.service || "unknown"}`);
        } else if (functionName === "breeds") {
          console.log(`🐕 Breeds count: ${response.data?.length || 0}`);
        } else if (functionName === "random") {
          console.log(
            `🎲 Random image: ${response.data?.message ? "received" : "none"}`,
          );
        } else if (functionName === "stats") {
          console.log(
            `📈 Stats: ${response.success ? "available" : "unavailable"}`,
          );
        }
      } catch (parseError) {
        console.log(`📄 Raw response: ${result.body.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error(`❌ ${functionName} function failed:`, error.message);

      // Show specific error details
      if (error.message.includes("MONGODB_URI")) {
        console.error("   💡 MongoDB connection string issue");
      } else if (error.message.includes("fetch")) {
        console.error("   💡 External API call issue");
      } else if (error.message.includes("Cannot find module")) {
        console.error("   💡 Missing dependency or file");
      }
    }
  }

  console.log("\n🎉 Barkend function testing completed!");
};

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Barkend test interrupted by user");
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
  process.exit(1);
});

// Run the tests
testFunctions().catch(console.error);
