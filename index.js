require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./admin-key.json"); // Ensure this path is correct

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// --- CORS Configuration ---
const allowedOrigins = [
  "http://localhost:5173", // Your frontend development server
  // Add your deployed frontend URL here when you deploy it!
   'https://food-sharing-2fa12.web.app/'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"], // Ensure Authorization is allowed
  credentials: true,
  optionsSuccessStatus: 200, // Use 200 for OPTIONS preflight
};

// --- Middleware ---
app.use(cors(corsOptions)); // Apply CORS configuration
app.options("*", cors(corsOptions)); // Handle preflight requests for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// --- MongoDB Configuration ---
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6clk9e4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// --- Firebase Token Verification Middleware ---
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decodedToken; // Attach decoded user info to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Firebase token verification error:", error); // Log the specific error
    return res.status(401).json({ message: "Unauthorized: Invalid token" }); // More specific error message
  }
};

// --- Main Async Function for Routes ---
async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect(); // You might uncomment this if needed, depending on your driver version

    // Define MongoDB collection
    const foodCollection = client.db("foodCollection").collection("foods");
    console.log("Connected to MongoDB!"); // Confirmation log

    // --- Routes ---

    // Simple root route
    app.get("/", (req, res) => {
      res.send("SharePlate Server is Running!");
    });

    // --- NEW: Verify Token Route ---
    // This route is specifically for the AuthProvider to check token validity
    app.get("/verify-token", verifyFirebaseToken, (req, res) => {
      // If the middleware 'verifyFirebaseToken' passes, the token is valid.
      console.log(
        "✅ Backend: /verify-token successful for user:",
        req.firebaseUser.email
      );
      res.status(200).json({
        message: "Token verified successfully.",
        user: {
          // Send back relevant user info if needed
          uid: req.firebaseUser.uid,
          email: req.firebaseUser.email,
        },
      });
    });
    // --- End Verify Token Route ---

    // Add data from client to database
    app.post("/add-food", verifyFirebaseToken, async (req, res) => {
      // Consider adding auth middleware
      // Add user email from verified token to the food data
      const foodData = {
        ...req.body,
        userEmail: req.firebaseUser.email,
        userName: req.firebaseUser.name || req.firebaseUser.email,
      };
      try {
        const result = await foodCollection.insertOne(foodData);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error adding food:", error);
        res.status(500).json({ message: "Failed to add food" });
      }
    });

    // All food api (public)
    app.get("/all-foods", async (req, res) => {
      try {
        const result = await foodCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching all foods:", error);
        res.status(500).json({ message: "Failed to fetch foods" });
      }
    });

    // Featured food only 6 food (public)
    app.get("/food-featured", async (req, res) => {
      try {
        const foods = await foodCollection.find().toArray();
        // Sort safely, handling potential non-numeric values
        foods.sort(
          (a, b) =>
            (Number(b.foodQuantity) || 0) - (Number(a.foodQuantity) || 0)
        );
        const featured = foods.slice(0, 6);
        res.send(featured);
      } catch (error) {
        console.error("Error fetching featured foods:", error);
        res.status(500).json({ message: "Failed to fetch featured foods" });
      }
    });

    // Single food details (public)
    app.get("/food/:id", async (req, res) => {
      try {
        const params = req.params.id;
        if (!ObjectId.isValid(params)) {
          return res.status(400).json({ message: "Invalid Food ID format" });
        }
        const id = { _id: new ObjectId(params) };
        const result = await foodCollection.findOne(id);
        if (!result) {
          return res.status(404).json({ message: "Food not found" });
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching single food:", error);
        res.status(500).json({ message: "Failed to fetch food details" });
      }
    });

    // Update food (requires authentication)
    app.put("/food/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Food ID format" });
        }
        const query = {
          _id: new ObjectId(id),
          userEmail: req.firebaseUser.email,
        }; // Ensure user can only update their own food

        // Prevent updating sensitive fields like userEmail, _id, requestInfo etc.
        const { _id, userEmail, userName, requestInfo, ...updateData } = data;

        const updatedDoc = { $set: updateData };
        const result = await foodCollection.updateOne(query, updatedDoc);

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({
              message:
                "Food not found or you don't have permission to update it.",
            });
        }
        res.send(result);
      } catch (error) {
        console.error("Error updating food:", error);
        res.status(500).json({ message: "Failed to update food" });
      }
    });

    // Find food added by a specific user (requires authentication)
    app.get("/foods", verifyFirebaseToken, async (req, res) => {
      // Added auth middleware
      // Get email from the verified token, not query param for security
      const email = req.firebaseUser.email;
      if (!email) {
        return res
          .status(400)
          .json({ message: "User email not found in token" });
      }
      const query = { userEmail: email };
      try {
        const result = await foodCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching user's foods:", error);
        res.status(500).send({ message: "Server error fetching user's foods" });
      }
    });

    // Request food (requires authentication)
    app.patch("/food/:id", verifyFirebaseToken, async (req, res) => {
      // Added auth middleware
      try {
        const id = req.params.id;
        const { requestDate, notes } = req.body;
        const requesterEmail = req.firebaseUser.email; // Get email from verified token

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Food ID format" });
        }
        if (!requesterEmail) {
          return res
            .status(400)
            .json({ message: "Requester email not found in token" });
        }

        const query = { _id: new ObjectId(id), status: "available" }; // Only request available food

        // Find the food item first to ensure the requester isn't the owner
        const foodItem = await foodCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!foodItem) {
          return res.status(404).json({ message: "Food item not found." });
        }
        if (foodItem.userEmail === requesterEmail) {
          return res
            .status(403)
            .json({ message: "You cannot request your own food item." });
        }
        if (foodItem.status !== "available") {
          return res
            .status(409)
            .json({ message: "Food is no longer available." }); // Conflict
        }

        const updateDoc = {
          $set: {
            status: "requested", // Changed from 'availability' to 'status' for consistency
            requestInfo: {
              userEmail: requesterEmail,
              requestDate: requestDate || new Date().toISOString(), // Use provided date or current date
              notes: notes || "", // Handle optional notes
            },
          },
        };

        const result = await foodCollection.updateOne(query, updateDoc);
        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({
              message: "Food not found or it's not available for request.",
            });
        }
        res.send(result);
      } catch (error) {
        console.error("Error updating food request:", error);
        res.status(500).json({ message: "Failed to update food request" });
      }
    });

    // Get foods requested by the logged-in user (requires authentication)
    app.get("/requested-foods", verifyFirebaseToken, async (req, res) => {
      const email = req.firebaseUser?.email;
      if (!email) {
        return res
          .status(400)
          .json({ message: "User email not found in token" });
      }
      try {
        const result = await foodCollection
          .find({
            status: "requested", // Changed from 'availability'
            "requestInfo.userEmail": email,
          })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(" Error fetching requested foods:", error);
        res
          .status(500)
          .json({ message: "Internal Server Error fetching requested foods" });
      }
    });

    // Only available food list (public) - Changed field name
    app.get("/available-foods", async (req, res) => {
      try {
        const foods = await foodCollection
          .find({ status: "available" }) // Changed from 'availability: "Available"'
          .toArray();
        res.send(foods);
      } catch (error) {
        console.error(" Error fetching available foods:", error);
        res
          .status(500)
          .json({ message: "Internal Server Error fetching available foods" });
      }
    });

    // Delete food (requires authentication)
    app.delete("/food/:id", verifyFirebaseToken, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid Food ID format" });
        }
        // Ensure user can only delete their own food
        const query = {
          _id: new ObjectId(id),
          userEmail: req.firebaseUser.email,
        };
        const result = await foodCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({
              message:
                "Food not found or you don't have permission to delete it.",
            });
        }
        res.send(result);
      } catch (error) {
        console.error(" Error deleting food:", error);
        res
          .status(500)
          .json({ message: "Internal Server Error deleting food" });
      }
    });

    // --- Start the server ---
    // Remove app.listen if deploying to Vercel, keep for local dev
    // app.listen(port, () => {
    //   console.log(`SharePlate server listening on port ${port}`);
    // });
  } catch (err) {
    // Catch potential connection errors
    console.error("Failed to connect to MongoDB or run server:", err);
    // process.exit(1); // Optional: exit if DB connection fails
  } finally {
    // Ensures client will close when you finish/error - Maybe not needed if always running?
    // await client.close();
  }
}

// Run the async function
run().catch(console.dir);

// --- Export app for Vercel ---
module.exports = app;
