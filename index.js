require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

const serviceAccount = require("./admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middle
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6clk9e4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decodedToken; // You can access user info like uid, email, etc.
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid token from catch" });
  }
};
async function run() {
  const foodCollection = client.db("foodCollection").collection("foods");

  try {
    app.get("/", verifyFirebaseToken, async (req, res) => {
      console.log(req.firebaseUser);

      res.send("Server is running!");
    });
    // add data from client to database
    app.post("/add-food", async (req, res) => {
      const body = req.body;
      const result = await foodCollection.insertOne(body);
      res.send(result);
    });
    //all food api
    app.get("/all-foods", async (req, res) => {
      const result = await foodCollection.find().toArray();
      res.send(result);
    });
    //featured food only 6 food
    app.get("/food-featured", async (req, res) => {
      const result = await foodCollection
        .find()
        .limit(6)
        .sort({ foodQuantity: -1 })
        .toArray();
      res.send(result);
    });

    //single food details
    app.get("/food/:id", async (req, res) => {
      const params = req.params.id;
      const id = { _id: new ObjectId(params) };
      const result = await foodCollection.findOne(id);
      res.send(result);
    });

    //update food
    app.put("/food/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: data,
      };
      const result = await foodCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    //find food by user email
    app.get("/foods", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }

      const query = { userEmail: email };
      try {
        const result = await foodCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data by userEmail:", error);
        res.status(500).send({ message: "Server error" });
      }
    });
    //requested
    app.patch("/food/:id", async (req, res) => {
      const id = req.params.id;
      const { userEmail, requestDate, notes } = req.body;
      if (!userEmail) {
        return res.status(400).json({ message: "User email required" });
      }
      const query = { _id: new ObjectId(id) };
      // Update document fields: availability + requestInfo (or similar)
      const updateDoc = {
        $set: {
          availability: "requested",
          requestInfo: {
            userEmail,
            requestDate,
            notes,
          },
        },
      };
      try {
        const result = await foodCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating food request:", error);
        res.status(500).json({ message: "Failed to update food request" });
      }
    });
///requested food match with token
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
            availability: "requested",
            "requestInfo.userEmail": email,
          })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("❌ Error fetching requested foods:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    //only available food list
    app.get("/available-foods", async (req, res) => {
      const foods = await foodCollection
        .find({ availability: "Available" })
        .toArray();
      res.send(foods);
    });

    //delete api
    app.delete("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
