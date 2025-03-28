require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("tasty-bites");

// Collections
const foodCollection = db.collection("foods");

// Middleware to validate MongoDB ID
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return respond(res, 400, "Invalid food ID format");
  }
  next();
};
/* Utility functions Start **/
//Capitalized letter function
const capitalizedFirstLetter = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// ConvertNumberFields Function
function convertNumberFields(data, fields) {
  const converted = { ...data };
  fields.forEach((field) => {
    if (converted[field] !== undefined && converted[field] !== null) {
      converted[field] = Number(converted[field]);
    }
  });
  return converted;
}
/* Utility functions End **/

// Respond function
const respond = (res, httpStatus, message, data = null) => {
  const statusType =
    httpStatus >= 200 && httpStatus < 300 ? "success" : "error";
  const response = {
    status: statusType,
    httpStatus,
    message,
    count: Array.isArray(data) ? data?.length : data ? 1 : 0,
    data: data || (Array.isArray(data) ? [] : null),
  };
  return res.status(httpStatus).json(response);
};

// Crud Operation Function
const crudOperation = async (
  operation,
  collection,
  data,
  res,
  options = {}
) => {
  console.log(`data: ${data}`)
  console.log(`res: ${res}`)
  console.log(`options: ${options}`)
  try {
    let result;
    switch (operation) {
      case "create":
        result = await collection.insertOne(data);
        respond(
          res,
          201,
          `${capitalizedFirstLetter(options.entity)} created successfully`,
          result
        );
        break;
      case "read":
      result = await collection.find().toArray();
        respond(
          res,
          result.length > 0 ? 200 : 404,
          result.length > 0
            ? `${capitalizedFirstLetter(options.entity)} retrieved successfully`
            : `No ${capitalizedFirstLetter(options.entity)} found`,
          result
        );
        break;
      case "readOne":
        result = await collection.findOne(data);
        respond(
          res,
          result ? 200 : 404,
          result
            ? `${capitalizedFirstLetter(options.entity)} retrieved successfully`
            : `${capitalizedFirstLetter(options.entity)} not found`,
          result
        );
        break;
      case "update":
        result = await collection.updateOne(options.filter, { $set: data });
        respond(
          res,
          result.modifiedCount > 0 ? 200 : 404,
          result.modifiedCount > 0
            ? `${capitalizedFirstLetter(options.entity)} updated successfully`
            : `${capitalizedFirstLetter(options.entity)} not found`,
          result
        );
        break;
      case "delete":
        result = await collection.deleteOne(options.filter);
        respond(
          res,
          result.deletedCount > 0 ? 200 : 404,
          result.deletedCount > 0
            ? `${capitalizedFirstLetter(options.entity)} deleted successfully`
            : `${capitalizedFirstLetter(options.entity)} not found`,
          result
        );
        break;
      default:
        return respond(res, 400, "Invalid operation");
    }
  } catch (error) {
    console.error(`CRUD operation error: ${error}`);
    respond(
      res,
      500,
      `Failed to perform ${operation} operator on ${options.entity || "item"}`
    );
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Auth Related API
    // Food Related API
    app.post("/food", async (req, res) => {
      const numberFields = ["price", "quantity"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation("create", foodCollection, foodData, res, {
        entity: "food",
      });
    });

    app.get("/foods", async (req, res) => {
      // const { search, sort, page, limit } = req.query;
      await crudOperation("read", foodCollection, {}, res, {
        entity: "foods"
      });
    });

    app.get("/food/:id", validateObjectId, async (req, res) => {
      console.log(req);
      await crudOperation(
        "readOne",
        foodCollection,
        { _id: new ObjectId(req.params.id) },
        res,
        { entity: "food" }
      );
    });

    app.put("/food/:id", validateObjectId, async (req, res) => {
      const numberFields = ["price", "quantity"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation("update", foodCollection, foodData, res, {
        entity: "food",
        filter: { _id: new ObjectId(req.params.id) },
      });
    });

    app.patch("/food/:id", validateObjectId, async (req, res) => {
      const numberFields = ["price", "quantity"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation("update", foodCollection, foodData, res, {
        entity: "food",
        filter: { _id: new ObjectId(req.params.id) },
      });
    });

    app.delete("/food/:id", validateObjectId, async (req, res) => {
      await crudOperation("delete", foodCollection, null, res, {
        entity: "food",
        filter: { _id: new ObjectId(req.params.id) },
      });
    });

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
