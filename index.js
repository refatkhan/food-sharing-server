require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();

// 🟢 CORS Middleware (must be first)
const allowedOrigins = [
  "https://food-sharing-2fa12.web.app", // Your production frontend
  "http://localhost:3000", // Your local frontend (e.g., Create React App)
  "http://localhost:5173", // Your local frontend (e.g., Vite)
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  // Preflight handling
  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});

// ✅ Parse JSON
app.use(express.json());

// 🧩 Firebase Admin Init
let serviceAccount = {};
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(
      /\\n/g,
      "\n"
    );
  }
} catch (err) {
  console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", err);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 🔒 Firebase Token Middleware
const verifyFirebaseToken = async (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized: No token" });

  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

// 🗄️ MongoDB Connection (Refactored)
let db;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6clk9e4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Function to connect to the database
async function connectToDb() {
  if (db) return db;
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB!");
    db = client.db("foodCollection");
    return db;
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB", err);
    // This will cause the function invocation to fail, which is correct.
    throw err;
  }
}

// Middleware to ensure DB connection for each request
app.use(async (req, res, next) => {
  if (!db) {
    await connectToDb();
  }
  req.db = db;
  next();
});

// --- API ROUTES (Now defined at the top level) ---

// 🟢 Health check
app.get("/", (req, res) => res.send("Food Sharing Server Running ✅"));

// ✅ NEW: Add the missing /verify-token endpoint
app.get("/verify-token", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    res.status(200).json({ message: "Token is valid", user: decodedToken });
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
});
// ➕ Add food
app.post("/add-food", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const result = await foodCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    console.error("Error adding food:", err);
    res.status(500).json({ message: "Failed to add food" });
  }
});

// 🍱 Get all foods
app.get("/all-foods", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const result = await foodCollection.find().toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching all foods:", err);
    res.status(500).json({ message: "Failed to fetch foods" });
  }
});

// 🌟 Featured foods (Top 6)
app.get("/food-featured", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const foods = await foodCollection.find().toArray();
    const featured = foods
      .sort((a, b) => Number(b.foodQuantity) - Number(a.foodQuantity))
      .slice(0, 6);
    res.send(featured);
  } catch (err) {
    console.error("Error fetching featured foods:", err);
    res.status(500).json({ message: "Failed to fetch featured foods" });
  }
});

// 🔍 Single food
app.get("/food/:id", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const result = await foodCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  } catch (err) {
    console.error("Error fetching single food:", err);
    res.status(500).json({ message: "Failed to fetch food" });
  }
});

// ✏️ Update food
app.put("/food/:id", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const query = { _id: new ObjectId(req.params.id) };
    const updateDoc = { $set: req.body };
    const result = await foodCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (err) {
    console.error("Error updating food:", err);
    res.status(500).json({ message: "Failed to update food" });
  }
});

// 📧 Find foods by user email
app.get("/foods", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: "Email required" });
    const result = await foodCollection.find({ userEmail: email }).toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching foods by email:", err);
    res.status(500).json({ message: "Failed to fetch foods" });
  }
});

// 📨 Request food
app.patch("/food/:id", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const { userEmail, requestDate, notes } = req.body;
    if (!userEmail)
      return res.status(400).json({ message: "User email required" });
    const query = { _id: new ObjectId(req.params.id) };
    const updateDoc = {
      $set: {
        availability: "requested",
        requestInfo: { userEmail, requestDate, notes },
      },
    };
    const result = await foodCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (err) {
    console.error("Error requesting food:", err);
    res.status(500).json({ message: "Failed to request food" });
  }
});

// 🧾 Requested foods (protected)
app.get("/requested-foods", verifyFirebaseToken, async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const email = req.firebaseUser?.email;
    if (!email) return res.status(400).json({ message: "Email not found" });
    const result = await foodCollection
      .find({ availability: "requested", "requestInfo.userEmail": email })
      .toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching requested foods:", err);
    res.status(500).json({ message: "Failed to fetch requested foods" });
  }
});

// ✅ Available foods only
app.get("/available-foods", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const result = await foodCollection
      .find({ availability: { $in: ["Available", "available"] } }) // Use the $in operator
      .toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching available foods:", err);
    res.status(500).json({ message: "Failed to fetch available foods" });
  }
});

// 🗑️ Delete food
app.delete("/food/:id", async (req, res) => {
  try {
    const foodCollection = req.db.collection("foods");
    const query = { _id: new ObjectId(req.params.id) };
    const result = await foodCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error("Error deleting food:", err);
    res.status(500).json({ message: "Failed to delete food" });
  }
});

// ✅ Export app for Vercel
module.exports = app;
