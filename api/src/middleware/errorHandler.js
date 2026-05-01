const { ZodError } = require("zod");
const multer = require("multer");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Zod validation
  if (err instanceof ZodError) {
    // eslint-disable-next-line no-console
    console.warn("[validation]", req.method, req.originalUrl, err.issues);
    return res.status(400).json({
      error: {
        message: "Validation error",
        issues: err.issues,
      },
    });
  }

  // Multer (file upload) errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: {
          message: "Receipt file is too large. Please upload a smaller file (max 25MB).",
        },
      });
    }
    return res.status(400).json({
      error: {
        message: err.message || "Upload failed",
      },
    });
  }

  const status = err.statusCode || err.status || 500;
  const message =
    status >= 500 ? "Internal server error" : err.message || "Request failed";

  if (status >= 500) {
    // Avoid leaking secrets; still log for dev.
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return res.status(status).json({
    error: {
      message,
    },
  });
}

module.exports = { errorHandler };



