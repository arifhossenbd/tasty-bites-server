require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const { crudOperation } = require("./utils/crudOperation");
const {
  respond,
  convertNumberFields
} = require("./utils/helpers");

// Middleware
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Middleware to validate MongoDB ID
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return respond(res, 400, "Invalid food ID format");
  }
  next();
};

// Token Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .send({ success: false, message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ success: false, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = process.env.MONGODB_URI;

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Auth Related API
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        })
        .send({ success: true, token });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        })
        .send({ success: true });
    });

    app.post("/food", async (req, res) => {
      try {
        const numberFields = ["price", "quantity"];
        const foodData = convertNumberFields(req.body, numberFields);
        const { foodName, foodImage, ...restData } = foodData;
        const email = req.decoded?.email;
        const existingData = await foodCollection.findOne({
          foodName: { $regex: new RegExp(`^${foodName}`, "i") },
          foodImage: foodImage,
          "addedBy.email": email,
        });

        if (existingData) {
          return respond(res, 409, `${foodName} already exists.`);
        }
        const newFood = {
          foodName,
          foodImage,
          ...restData,
          createAt: Date.now(),
          updateAt: Date.now(),
        };
        await crudOperation("create", foodCollection, newFood, res, {
          entity: "food",
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.get("/foods", async (req, res) => {
      try {
        await crudOperation("read", foodCollection, {}, res, {
          entity: "foods",
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.get("/food/:id", validateObjectId, async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      try {
        await crudOperation("readOne", foodCollection, null, res, {
          entity: "food",
          filter,
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.put("/food/:id", validateObjectId, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const numberFields = ["price", "quantity", "createAt", "updateAt"];
        const foodData = convertNumberFields(req.body, numberFields);
        foodData.updateAt = Date.now();
        const time = new Date();
        function formatTime(time) {
          return new Date(time).toLocaleTimeString();
        }
        console.log(formatTime(time), `Update time: ${foodData?.updateAt}`);
        await crudOperation("update", foodCollection, foodData, res, {
          entity: "food",
          filter,
        });
      } catch (error) {
        console.error(error);
        respond(res, 500, "Something went wrong");
      }
    });

    /** My Foods Related APIs */
    app.get("/my-foods", verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;

        if (!email) {
          return respond(res, 400, "User email is required for this operation");
        }
        // Validate the email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return respond(res, 400, "Invalid email format");
        }
        const filter = { "addedBy.email": email };
        await crudOperation("read", foodCollection, null, res, {
          entity: "foods",
          filter,
        });
      } catch (error) {
        respond(res, 500, "Something went wrong");
      }
    });

    app.delete("/food/:id", validateObjectId, async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const result = await foodCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
          return respond(res, 404, "Food not found");
        }
        respond(res, 200, "Food deleted successfully", result);
      } catch (error) {
        respond(res, 500, "Something went wrong");
      }
    });

    /** My Foods Related APIs */

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
