// Import the Mongoose library to connect and interact with MongoDB.
const mongoose = require("mongoose");

// Import the colors package to add colors to console messages.
const colors = require("colors");

// Create an asynchronous function to establish a connection with MongoDB.
const connectDb = async () => {
  try {
    // Connect to MongoDB using the connection URL stored in the environment variable.
    await mongoose.connect(process.env.MONGO_URL);

    // Display a success message in the terminal with a cyan background and white text.
    console.log(`MongoDB Connection Established...`.bgCyan.white);

  } catch (error) {
    // Catch any errors that occur while connecting to MongoDB.
    // Display the error message in the terminal with a red background.
    console.log(`${error}`.bgRed);
  }
};

// Export the connectDb function so it can be imported and used in other files.
module.exports = connectDb;
