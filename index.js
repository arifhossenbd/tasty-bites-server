require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } catch (err) {
    console.error(`Something went wrong: ${err}`);
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run();

app.get("/", (req, res) => {
  res.send("Server is cooking!");
});

app.listen(port, () => {
  console.log(`Server is running on port: http://localhost:${port}`);
});
