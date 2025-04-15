require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const { crudOperation } = require("./utils/crudOperation");
const { respond, convertNumberFields } = require("./utils/helpers");

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
const orderCollection = db.collection("orders");
const wishlistCollection = db.collection("wishlists");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Validate the email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    /** Foods Related APIs */
    app.post("/add/food", verifyToken, async (req, res) => {
      try {
        const numberFields = ["price", "quantity"];
        const foodData = convertNumberFields(req.body, numberFields);
        const { name, image, ...restData } = foodData;
        const email = req.decoded?.email;
        const existingData = await foodCollection.findOne({
          name: { $regex: new RegExp(`^${name}`, "i") },
          image: image,
          "addedBy.email": email,
        });

        if (existingData) {
          return respond(res, 409, `${name} already exists.`);
        }
        const newFood = {
          name,
          image,
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

    app.get("/top/foods", async (req, res) => {
      try {
        const limit = parseInt(req.query.latest) || 9;
        await crudOperation("read", foodCollection, {}, res, {
          entity: "foods",
          sort: { purchaseCount: -1 },
          limit: limit,
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.get("/latest/foods", async (req, res) => {
      try {
        const limit = parseInt(req.query.latest) || 5;
        await crudOperation("read", foodCollection, {}, res, {
          entity: "foods",
          sort: { updateAt: -1 },
          limit: limit,
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.get("/categories", async (req, res) => {
      try {
        const result = await foodCollection
          .aggregate([
            {
              $match: {
                category: { $ne: null }, // 🛡️ Ensure category exists
              },
            },
            {
              $group: {
                _id: "$category",
                items: { $push: "$$ROOT" }, // 🔄 Push full document (all fields)
              },
            },
            {
              $project: {
                name: "$_id", // Rename _id to name
                items: 1,
                _id: 0,
              },
            },
            {
              $sort: { name: 1 }, // 🔤 Sort by category name alphabetically
            },
          ])
          .toArray();

        respond(res, 200, "Categories data retrieved", result); // ✅ Consistent response
      } catch (err) {
        console.error("Error getting category-wise foods:", err);
        res.status(500).json({ error: "Failed to get categories" }); // 🛡️ Consistent error
      }
    });

    app.get(
      "/food/details/:id",
      verifyToken,
      validateObjectId,
      async (req, res) => {
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
      }
    );

    app.get("/my-foods", verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;

        if (!email) {
          return respond(res, 400, "User email is required for this operation");
        }
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

    app.put(
      "/update/food/:id",
      verifyToken,
      validateObjectId,
      async (req, res) => {
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
      }
    );

    app.delete(
      "/delete/food/:id",
      verifyToken,
      validateObjectId,
      async (req, res) => {
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
      }
    );
    /** Foods Related APIs */

    app.post("/checkout", verifyToken, async (req, res) => {
      const data = req.body;
      try {
        const result = await orderCollection.insertOne(data);
        const cartItems = data?.items;
        const bulkOps = cartItems?.map((item) => ({
          updateOne: {
            filter: { _id: new ObjectId(item?.foodId) },
            update: {
              $inc: {
                quantity: -(item?.quantity || 1),
                purchaseCount: item?.quantity || 1,
              },
            },
          },
        }));
        const updateResult = await foodCollection.bulkWrite(bulkOps);
        respond(res, 200, "Order Confirmed & Stock Updated", {
          orderInsert: result,
          stockUpdate: updateResult,
        });
      } catch (error) {
        console.error("Checkout failed:", error);
        respond(res, 500, "Checkout Failed", { error });
      }
    });

    app.get("/my-orders", verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;

        if (!email) {
          return respond(res, 400, "User email is required for this operation");
        }
        if (!emailRegex.test(email)) {
          return respond(res, 400, "Invalid email format");
        }
        const filter = { "user.email": email };
        await crudOperation("read", orderCollection, null, res, {
          entity: "orders",
          filter,
        });
      } catch (error) {
        respond(res, 500, "Something went wrong");
      }
    });

    app.post("/add/wishlist", verifyToken, async (req, res) => {
      try {
        const numberFields = ["price", "quantity"];
        const foodData = convertNumberFields(req.body, numberFields);
        const { foodId, name, image, ...restData } = foodData;
        const existingData = await wishlistCollection.findOne({foodId});

        if (existingData) {
          return respond(res, 409, `${name} already exists.`);
        }
        const newFood = {
          foodId,
          name,
          image,
          ...restData,
          createAt: Date.now(),
          updateAt: Date.now(),
        };
        await crudOperation("create", wishlistCollection, newFood, res, {
          entity: "food",
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    });

    app.get("/wishlist", verifyToken, async (req, res) => {
      try {
        const email = req.decoded?.email;

        if (!email) {
          return respond(res, 400, "User email is required for this operation");
        }
        if (!emailRegex.test(email)) {
          return respond(res, 400, "Invalid email format");
        }
        const filter = { "user.email": email };
        await crudOperation("read", wishlistCollection, null, res, {
          entity: "wishlist",
          filter,
        });
      } catch (error) {
        respond(res, 500, "Something went wrong");
      }
    });

    app.delete(
      "/delete/wishlist/item/:id",
      verifyToken,
      validateObjectId,
      async (req, res) => {
        try {
          const filter = { _id: new ObjectId(req.params.id) };
          const result = await wishlistCollection.deleteOne(filter);
          if (result.deletedCount === 0) {
            return respond(res, 404, "Food not found");
          }
          respond(res, 200, "Food deleted successfully", result);
        } catch (error) {
          respond(res, 500, "Something went wrong");
        }
      }
    );

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
