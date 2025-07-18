require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
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

async function run() {
  const foodCollection = client.db("foodCollection").collection("foods");

  try {
    app.get("/", (req, res) => {
      res.send("Hello World!");
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
    //featured room only 6 room
    app.get("/food-featured", async (req, res) => {
      const result = await foodCollection.find().limit(6).toArray();
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
