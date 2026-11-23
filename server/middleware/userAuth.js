
// Import the Google Authentication User Model.
// This model is used to find users who registered or logged in using Google authentication.
const GoogleAuthUserModel = require("../models/model.user.googleAuth");

// Import the normal User Model.
// This model is used to find users who registered using the regular email/password method.
const userModel = require("../models/userModel");

// Import the jsonwebtoken package.
// This package is used to verify JWT tokens and check whether they are valid or expired.
const jwt = require("jsonwebtoken");


// Create an asynchronous middleware function to check whether the user is authenticated.
// req: Contains information about the incoming request.
// res: Used to send a response back to the client.
// next: Calls the next middleware or controller if authentication is successful.
const checkUserAuth = async (req, res, next) => {

  // Extract the authorization header from the incoming request.
  // The client should send the JWT token inside this header.
  const { authorization } = req.headers;

  // Check whether the authorization header exists.
  // Also check whether it starts with "Bearer".
  // If the header is missing or has an incorrect format, authentication will fail.
  if (!authorization || !authorization.startsWith("Bearer")) {

    // Return a 401 Unauthorized response.
    // This means the user has not provided an authentication token.
    return res.status(401).send({
      status: "failed",
      message: "Unauthorized: No token provided, login again...!",
    });
  }

  try {

    // Extract the actual JWT token from the authorization header.
    // Example header: "Bearer abc123xyz"
    // split(" ") separates "Bearer" and the token into an array.
    // [1] selects the token part.
    const token = authorization.split(" ")[1];

    // Verify the JWT token using the secret key stored in the environment variables.
    // jwt.verify() checks the token's signature and expiration time.
    // If the token is valid, it returns the decoded token payload.
    // Here, expenseAppUserId is extracted from that payload.
    const { expenseAppUserId } = jwt.verify(token, process.env.JWT_SECRETE_KEY);

    // Find the user in the normal user collection first.
    // findOne() searches for a user with the matching expenseAppUserId.
    // select("-password") excludes the password field from the returned user data.
    // lean() returns a plain JavaScript object instead of a Mongoose document.
    const user =
      (await userModel
        .findOne({ expenseAppUserId })
        .select("-password")
        .lean()) ||

      // If the user is not found in the normal user collection,
      // search for the same user in the Google Authentication collection.
      // select("-googleId") excludes the Google ID from the returned data.
      // lean() converts the result into a plain JavaScript object.
      (await GoogleAuthUserModel.findOne({ expenseAppUserId })
        .select("-googleId")
        .lean());

    // Check whether the user was found in either collection.
    // If no matching user exists, authentication will fail.
    if (!user) {

      // Return a 401 Unauthorized response because the user account was not found.
      return res.status(401).send({
        status: "failed",
        message: "Unauthorized: User not found, login again...!",
      });
    }

    // Attach the authenticated user's information to the request object.
    // This makes user information available in the next middleware or controller.
    // For example, the next controller can access it using req.user.
    req.user = user;

    // Call the next middleware or controller.
    // This means the authentication process was successful.
    next();

  } catch (error) {

    // Display the authentication error in the server console.
    // This helps developers identify problems during token verification
    // or database operations.
    console.error("Auth Middleware Error:", error);

    // Return a 401 Unauthorized response.
    // This handles invalid tokens, expired tokens, verification errors,
    // and other errors occurring inside the try block.
    return res.status(401).send({
      status: "failed",
      message: "Unauthorized: Invalid or expired token, login again...!",
    });
  }
};

// Export the middleware function.
// This allows other files to import and use checkUserAuth
// to protect routes that require user authentication.
module.exports = checkUserAuth;
