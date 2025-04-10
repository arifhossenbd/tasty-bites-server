const { respond } = require("./helpers");

exports.crudOperation = async (
  operation,
  collection,
  data,
  res,
  options = {}
) => {
  const { entity = "item", filter = {}, projection = {} } = options;

  try {
    let result;
    let message = "";

    switch (operation) {
      case "create":
        result = await collection.insertOne(data);
        message = `${entity} created successfully`;
        if (result?.insertedId) {
          return respond(res, 201, message, result);
        } else {
          return respond(
            res,
            400,
            `${entity} failed to be added in server`,
            result
          );
        }

      case "read":
        let cursor = collection.find(filter);
        if (options.sort) {
          cursor = cursor.sort(options.sort);
        }
        if (options.limit) {
          cursor = cursor.limit(options.limit);
        }
        result = await cursor.toArray();
        message = `${entity} retrieved successfully`;
        if (!result.length) {
          return respond(res, 404, `${entity} not found`);
        } else {
          return respond(res, 200, message, result);
        }

      case "readOne":
        result = await collection.findOne(filter, { projection });
        message = `${entity} retrieved successfully`;
        if (!result) {
          return respond(res, 404, `${entity} not found`);
        } else {
          return respond(res, 200, message, result);
        }

      case "update":
        delete data._id;
        result = await collection.updateOne(filter, {
          $set: data,
        });
        message = `${entity} updated successfully`;

        if (!result.modifiedCount) {
          return respond(res, 404, `${entity} not found`);
        } else {
          return respond(res, 200, message, result);
        }

      case "delete":
        result = await collection.deleteOne(filter);
        message = `${entity} deleted successfully`;
        if (!result.deletedCount) {
          return respond(res, 404, `${entity} not found`);
        } else {
          return respond(res, 200, message, result);
        }

      default:
        return respond(res, 400, "Invalid operation");
    }
  } catch (err) {
    console.error("Error:", err);
  }
};
