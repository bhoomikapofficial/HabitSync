/**
 * Wraps an async Express route handler so that any thrown error or
 * rejected promise is automatically forwarded to next(), instead of
 * requiring a try/catch block in every controller function.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
