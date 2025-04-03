require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

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
  console.log(token)
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

// SortingFunction
const sortFunc = (sortQuery) => {
  if (!sortQuery) return { _id: -1 };
  const [field, direction] = sortQuery.split(":");
  const sortDirection = direction === "asc" ? 1 : -1;

  const validSortFields = ["price", "name", "createdAt", "rating"];
  if (validSortFields.includes(field)) {
    return { [field]: sortDirection };
  }
  return { _id: -1 };
};

// SearchQueryFunction
const searchFunc = (searchTerm) => {
  if (!searchTerm) return {};
  return {
    $or: [
      { name: { $regex: searchTerm, $options: "i" } },
      { category: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
    ],
  };
};

// Pagination function
const paginationFunc = async (collection, query = {}, options = {}) => {
  const { page, limit, sort } = options;

  // Check if pagination parameter exists
  const shouldPaginate = page !== undefined || limit !== undefined;

  if (!shouldPaginate) {
    // Return all results if no pagination requested
    const data = await collection
      .find(query)
      .sort(sort || { _id: -1 })
      .toArray();
    return {
      data,
      pagination: null,
    };
  }

  // Apply pagination
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (currentPage - 1) * pageSize;

  const [data, total] = await Promise.all([
    collection
      .find(query)
      .sort(sort || { _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(query),
  ]);
  return {
    data,
    pagination: {
      total,
      page: currentPage,
      pages: Math.ceil(total / pageSize),
      limit: pageSize,
    },
  };
};

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
        const { data: resultData, pagination } = await paginationFunc(
          collection,
          data,
          {
            page: options.page,
            limit: options.limit,
            sort: options.sort,
          }
        );
        const responseData = pagination
          ? { data: resultData, pagination }
          : resultData;
        respond(
          res,
          resultData.length > 0 ? 200 : 404,
          resultData.length > 0
            ? `${capitalizedFirstLetter(options.entity)} retrieved successfully`
            : `No ${capitalizedFirstLetter(options.entity)} found`,
          responseData
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

    // Food Related API
    app.post("/food", verifyToken, async (req, res) => {
      const numberFields = ["price", "quantity"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation(
        "create",
        foodCollection,
        { ...foodData, createAt: Date.now(), updateAt: Date.now() },
        res,
        {
          entity: "food",
        }
      );
    });

    app.get("/foods", async (req, res) => {
      const { search, sort, page, limit } = req.query;
      await crudOperation("read", foodCollection, searchFunc(search), res, {
        entity: "foods",
        sort: sortFunc(sort),
        page: page,
        limit: limit,
      });
    });

    app.get("/food/:id", verifyToken, validateObjectId, async (req, res) => {
      console.log(req);
      await crudOperation(
        "readOne",
        foodCollection,
        { _id: new ObjectId(req.params.id) },
        res,
        { entity: "food" }
      );
    });

    app.put("/food/:id", verifyToken, validateObjectId, async (req, res) => {
      const numberFields = ["price", "quantity", "createAt"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation(
        "update",
        foodCollection,
        { ...foodData, updateAt: Date.now() },
        res,
        {
          entity: "food",
          filter: { _id: new ObjectId(req.params.id) },
        }
      );
    });

    app.patch("/food/:id", verifyToken, validateObjectId, async (req, res) => {
      const numberFields = ["price", "quantity"];
      const foodData = convertNumberFields(req.body, numberFields);
      await crudOperation(
        "update",
        foodCollection,
        { ...foodData, updateAt: Date.now() },
        res,
        {
          entity: "food",
          filter: { _id: new ObjectId(req.params.id) },
        }
      );
    });

    app.delete("/food/:id", verifyToken, validateObjectId, async (req, res) => {
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
