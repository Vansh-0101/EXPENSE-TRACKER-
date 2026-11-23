
// Import the transaction model.
// This model is used to perform CRUD operations (Create, Read, Update, Delete)
// on transaction records stored in the MongoDB database.
const transectionModel = require("../models/transectionModel");

// Import Moment.js to work with dates.
// It helps calculate date ranges, such as fetching transactions
// from the last 7 days, 30 days, etc.
const moment = require("moment");

// Import customAlphabet from Nano ID.
// It allows us to generate unique IDs using a custom set of characters.
const { customAlphabet } = require("nanoid");

// Define the characters that can be used to generate transaction IDs.
// It includes:
// 0-9: Numbers
// A-Z: Uppercase letters
// a-z: Lowercase letters
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// --------------------------------------------------
// 1. GET ALL TRANSACTIONS
// --------------------------------------------------

// This function fetches all transactions belonging to the logged-in user.
// It can filter transactions based on:
// 1. Frequency (number of days or custom date range)
// 2. Selected date range
// 3. Transaction type (income, expense, or all)
const getAllTransaction = async (req, res) => {
  try {
    // Extract filtering details from the request body.
    // frequency: Number of days or "custom" for a custom date range.
    // selectedDate: Array containing the start date and end date.
    // type: Transaction type, such as income, expense, or all.
    const { frequency, selectedDate, type } = req.body;

    // Fetch transactions from MongoDB using the find() method.
    const transactions = await transectionModel.find({

      // Apply the date filter depending on the selected frequency.
      ...(frequency !== "custom"
        ? {
            // If the frequency is not custom, fetch transactions
            // created after the calculated date.
            date: {
              // Subtract the selected number of days from the current date.
              // Example: If frequency is 7, fetch transactions from the last 7 days.
              // $gt means the date must be greater than the calculated date.
              $gt: moment().subtract(Number(frequency), "d").toDate(),
            },
          }
        : {
            // If frequency is custom, use the date range
            // provided by the user.
            date: {
              // $gte means greater than or equal to the starting date.
              $gte: selectedDate[0],

              // $lte means less than or equal to the ending date.
              $lte: selectedDate[1],
            },
          }),

      // Fetch only transactions belonging to the currently logged-in user.
      // req.user.expenseAppUserId is expected to be added by authentication middleware.
      expenseAppUserId: req.user.expenseAppUserId,

      // Apply the transaction type filter only when type is not "all".
      // If type is "income" or "expense", only matching records are returned.
      // If type is "all", this condition is not added to the query.
      ...(type !== "all" && { type }),
    });

    // Send a successful response with all matching transactions.
    res
      .status(200)
      .json({
        status: "success.",
        message: "All transactions fetched successfully.",

        // Return the transactions received from MongoDB.
        transactions: transactions,
      });

  } catch (error) {
    // Print the error in the server console for debugging.
    console.log(error);

    // Send a 500 Internal Server Error response
    // if something goes wrong while fetching transactions.
    res
      .status(500)
      .json({
        status: "failed",
        message: "Failed to fetch transactions.",
        error: error,
      });
  }
};

// --------------------------------------------------
// 2. GET ONE TRANSACTION
// --------------------------------------------------

// This function fetches a single transaction using its transaction ID.
// It also checks whether the transaction belongs to the logged-in user.
const getOneTransaction = async (req, res) => {

  // Extract the transaction ID from the URL parameters.
  // Example: /api/transactions/ABC1234567
  const { transactionId } = req.params;

  try {
    // Search for one transaction in the MongoDB database.
    const transaction = await transectionModel.findOne({

      // Find the transaction with the requested transaction ID.
      transactionId: transactionId,

      // Make sure the transaction belongs to the logged-in user.
      // This prevents users from accessing another user's transaction.
      expenseAppUserId: req.user.expenseAppUserId,
    });

    // Check whether the requested transaction exists.
    if (!transaction) {

      // If the transaction is not found, return a 404 Not Found response.
      return res.status(404).json({
        status: "failed",
        message: "Transaction not found or you don't have access to this transaction.",
      });
    }

    // If the transaction exists, return it successfully.
    res
      .status(200)
      .json({
        status: "success",
        message: "Transaction fetched successfully.",

        // Send the transaction details in the response.
        transaction: transaction,
      });

  } catch (error) {
    // Print the error in the server console.
    console.log(error);

    // Return a 500 response if an unexpected error occurs.
    res
      .status(500)
      .json({
        status: "failed",
        message: "Failed to fetch transaction.",
        error: error,
      });
  }
};

// --------------------------------------------------
// 3. ADD NEW TRANSACTION
// --------------------------------------------------

// This function creates and saves a new transaction
// for the currently logged-in user.
const addTransaction = async (req, res) => {

  // Extract transaction details from the request body.
  const { amount, type, category, refrence, description, date } = req.body;

  try {
    // Create a custom Nano ID generator using the alphabet defined above.
    // The second argument (10) specifies that every generated ID
    // should contain exactly 10 characters.
    const nanoid = customAlphabet(alphabet, 10);

    // Generate a unique transaction ID.
    const nanoId = nanoid();

    // Create a new transaction document using the transaction model.
    const newTransection = new transectionModel({

      // Store the ID of the currently logged-in user.
      // This connects the transaction to its owner.
      expenseAppUserId: req.user.expenseAppUserId,

      // Assign the newly generated unique transaction ID.
      transactionId: nanoId,

      // Store the transaction amount.
      amount: amount,

      // Store the transaction type, such as income or expense.
      type: type,

      // Store the category, such as food, shopping, salary, etc.
      category: category,

      // Store the transaction reference information.
      refrence: refrence,

      // Store the transaction description.
      description: description,

      // Store the transaction date.
      date: date,
    });

    // Save the newly created transaction document in MongoDB.
    await newTransection.save();

    // Return a 201 Created response after successfully saving the transaction.
    res.status(201).send({
      status: "success",
      message: "Transaction created successfully.",
    });

  } catch (error) {
    // Print the error in the server console for debugging.
    console.log(error);

    // Return a 500 response if the transaction could not be created.
    res.status(500).json({
      status: "failed",
      message: "Failed to create transaction.",
      error: error,
    });
  }
};

// --------------------------------------------------
// 4. EDIT / UPDATE TRANSACTION
// --------------------------------------------------

// This function updates an existing transaction.
// Before updating, it checks whether the transaction belongs
// to the currently logged-in user.
const editTransaction = async (req, res) => {

  // Extract updated transaction details from the request body.
  const { amount, type, category, refrence, description, date } = req.body;

  // Extract the transaction ID from the URL parameters.
  const { transactionId } = req.params;

  try {
    // First, check whether the requested transaction exists
    // and belongs to the logged-in user.
    const transaction = await transectionModel.findOne({

      // Search using the transaction ID.
      transactionId: transactionId,

      // Match the currently logged-in user's ID.
      expenseAppUserId: req.user.expenseAppUserId,
    });

    // If the transaction does not exist or belongs to another user,
    // stop execution and return a 404 response.
    if (!transaction) {
      return res.status(404).json({
        status: "failed",
        message: "Transaction not found or you don't have access to this transaction.",
      });
    }

    // Update the existing transaction using findOneAndUpdate().
    await transectionModel.findOneAndUpdate(

      // Find the transaction using its ID and user ID.
      // This ensures that only the owner can update the transaction.
      {
        transactionId: transactionId,
        expenseAppUserId: req.user.expenseAppUserId,
      },

      // Use $set to update the specified transaction fields.
      {
        $set: {

          // Update the transaction amount.
          amount: amount,

          // Update the transaction type.
          type: type,

          // Update the transaction category.
          category: category,

          // Update the transaction reference.
          refrence: refrence,

          // Update the transaction description.
          description: description,

          // Update the transaction date.
          date: date,
        },
      }
    );

    // Return a successful response after updating the transaction.
    return res.status(200).send({
      status: "success",
      message: "Transaction updated successfully.",
    });

  } catch (error) {
    // Print the error in the server console.
    console.log(error);

    // Return a 500 response if the update operation fails.
    res.status(500).json({
      status: "failed",
      message: "Failed to update transaction.",
      error: error,
    });
  }
};

// --------------------------------------------------
// 5. DELETE TRANSACTION
// --------------------------------------------------

// This function deletes an existing transaction.
// It first verifies that the transaction belongs to the logged-in user.
const deleteTransaction = async (req, res) => {

  // Extract the transaction ID from the URL parameters.
  const { transactionId } = req.params;

  try {
    // Check whether the transaction exists
    // and belongs to the currently logged-in user.
    const transaction = await transectionModel.findOne({

      // Search using the requested transaction ID.
      transactionId: transactionId,

      // Match the logged-in user's ID.
      expenseAppUserId: req.user.expenseAppUserId,
    });

    // If the transaction is not found or does not belong to the user,
    // return a 404 response and stop execution.
    if (!transaction) {
      return res.status(404).json({
        status: "failed",
        message: "Transaction not found or you don't have access to this transaction.",
      });
    }

    // Delete the transaction from MongoDB using findOneAndDelete().
    // Both transaction ID and user ID are checked again
    // to ensure that only the owner can delete the record.
    await transectionModel.findOneAndDelete({
      transactionId: transactionId,
      expenseAppUserId: req.user.expenseAppUserId,
    });

    // Return a successful response after deleting the transaction.
    res
      .status(200)
      .send({
        status: "success",
        message: "Transaction deleted successfully.",
      });

  } catch (error) {
    // Print the error in the server console for debugging.
    console.log(error);

    // Return a 500 response if the deletion operation fails.
    res
      .status(500)
      .json({
        status: "failed",
        message: "Failed to delete transaction.",
        error: error,
      });
  }
};

// --------------------------------------------------
// 6. EXPORT ALL CONTROLLER FUNCTIONS
// --------------------------------------------------

// Export all transaction controller functions.
// These functions can now be imported and connected
// to their respective API routes in the routes file.
module.exports = {
  getAllTransaction,
  getOneTransaction,
  addTransaction,
  editTransaction,
  deleteTransaction,
};
