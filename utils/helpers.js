exports.convertNumberFields = (obj, fields) => {
  fields.forEach((field) => {
    if (obj[field]) {
      obj[field] = Number(obj[field]);
    }
  });
  return obj;
};

exports.queriesData = async (name, req, res) => {
  if (name) {
    const lowerCase = name.toLowerCase();
    const query = req.query.lowerCase;
    return query;
  }
};

exports.respond = (res, status, message = null, data = null) => {
  // Default messages for common status codes
  const statusMessages = {
    // Success 2xx
    200: "Request processed successfully",
    201: "Resource created successfully",
    202: "Request accepted for processing",
    204: "No content available",

    // Client Errors 4xx
    400: "Bad request",
    401: "Unauthorized access",
    403: "Forbidden",
    404: "Resource not found",
    409: "Conflict - Resource already exists",

    // Server Errors 5xx
    500: "Internal server error",
    501: "Not implemented",
    502: "Bad gateway",
    503: "Service unavailable",
  };

  const success = status >= 200 && status < 300;
  const response = {
    success,
    message:
      message ||
      statusMessages[status] ||
      (success ? "Operation successful" : "Operation failed"),
  };

  if (data) response.data = data;

  return res.status(status).json(response);
};
