import { ErrorRequestHandler } from "express";

export const handleRequestError: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  ) {
    res
      .status(400)
      .json({ success: false, message: "Invalid JSON request body" });
    return;
  }
  console.error(
    "Unhandled API request error:",
    error instanceof Error ? error.message : "Unknown request error",
  );
  res.status(500).json({ success: false, message: "Unexpected API error" });
};
