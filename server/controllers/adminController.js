// Import the Admin model to perform database operations related to admin accounts
const adminModel = require("../models/adminModel");

// Import the User model for fetching users registered through email
const userModel = require("../models/userModel");

// Import the Google Auth User model for fetching Google-authenticated users
const GoogleAuthUserModel = require("../models/model.user.googleAuth");

// Import the Transaction model to retrieve users' income and expense records
const transectionModel = require("../models/transectionModel");

// Import the Admin Phone Number model to manage admin phone numbers and OTP verification
const AdminPhoneNumberModel = require("../models/adminPhoneNumberModel");

// Import validator package to validate email addresses and other user inputs
const validator = require("validator");

// Import customAlphabet from nanoid to generate unique alphanumeric IDs and keys
const { customAlphabet } = require("nanoid");

// Define the characters that can be used while generating admin IDs
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Import the HTML email template used to send admin security keys
const adminKeyEmail = require("../utils/emailTemplates/adminKeyEmail");

// Import the email service used to send emails through Brevo
const sendMailThroughBrevo = require("../services/brevoEmailService");

// Import Axios to make HTTP requests to external APIs, such as the SMS service
const axios = require("axios");


// ======================================================
// REQUEST ADMIN ACCESS
// ======================================================

// This function allows a new user to request admin access.
// If the email is present in the allowed email list, admin access
// is automatically approved and an admin security key is generated.
// Otherwise, the request is saved for manual approval.

const requestAdminAccess = async (req, res) => {
  try {
    // Extract name, email, and phone number from the request body
    const { name, email, phone } = req.body;

    // Check whether the required name and email fields are provided
    if (!name || !email) {
      return res.status(400).json({
        status: "failed",
        message: "Name and email are required!",
      });
    }

    // Validate whether the provided email follows a valid email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: "failed",
        message: "Please provide a valid email address!",
      });
    }

    // Check whether an admin account or access request already exists
    // for the provided email address
    const existingAdmin = await adminModel.findOne({ email: email.toLowerCase().trim() });

    // If an admin already exists with this email, stop further execution
    if (existingAdmin) {
      return res.status(400).json({
        status: "failed",
        message: "Admin access request already exists for this email. Please wait for approval or contact support if you already have an admin key.",
      });
    }

    // Get the list of authorized admin email addresses from the .env file
    // Split multiple emails using commas and remove unnecessary spaces
    // Convert all email addresses to lowercase for consistent comparison
    const allowedEmails = process.env.ALLOWED_ADMIN_EMAILS
      ? process.env.ALLOWED_ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase())
      : [];

    // Normalize the submitted email address
    const emailLower = email.toLowerCase().trim();

    // --------------------------------------------------
    // GENERATE UNIQUE ADMIN ID
    // --------------------------------------------------

    // Declare variables used to generate and validate a unique admin ID
    let adminId;
    let isAdminIdUnique = false;
    let adminIdAttempts = 0;

    // Set the maximum number of attempts for generating a unique admin ID
    const maxAdminIdAttempts = 10;

    // Continue generating IDs until a unique ID is found or the maximum
    // number of attempts is reached
    while (!isAdminIdUnique && adminIdAttempts < maxAdminIdAttempts) {

      // Create a Nano ID generator that generates a 10-character ID
      // using numbers, uppercase letters, and lowercase letters
      const nanoid = customAlphabet(alphabet, 10);

      // Generate a new admin ID
      adminId = nanoid();

      // Check whether the generated admin ID already exists in the database
      const existingAdminId = await adminModel.findOne({ adminId });

      // If no matching admin ID exists, mark the generated ID as unique
      if (!existingAdminId) {
        isAdminIdUnique = true;
      }

      // Increase the attempt counter after every generation attempt
      adminIdAttempts++;
    }

    // If a unique admin ID could not be generated within the allowed attempts,
    // return a server error response
    if (!isAdminIdUnique) {
      return res.status(500).json({
        status: "failed",
        message: "Failed to generate unique admin ID. Please try again.",
      });
    }

    // --------------------------------------------------
    // CHECK ADMIN EMAIL AUTHORIZATION
    // --------------------------------------------------

    // Check whether the submitted email exists in the authorized email list
    const isEmailAllowed = allowedEmails.includes(emailLower);

    // If the email is authorized, automatically approve admin access
    if (isEmailAllowed) {

      // Email is in allowed list - Generate admin key and approve

      // Define the characters allowed in the admin security key
      // Only numbers and uppercase letters are permitted
      const uppercaseAlphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

      // Declare variables for generating a unique admin security key
      let adminKey;
      let isKeyUnique = false;
      let keyAttempts = 0;

      // Maximum number of attempts allowed for generating a unique key
      const maxKeyAttempts = 10;

      // Generate a unique 16-character admin security key
      while (!isKeyUnique && keyAttempts < maxKeyAttempts) {

        // Create a Nano ID generator for a 16-character uppercase alphanumeric key
        const nanoid = customAlphabet(uppercaseAlphanumeric, 16);

        // Generate a new admin security key
        adminKey = nanoid();

        // Check whether this security key already exists in the database
        const existingKey = await adminModel.findOne({ adminKey });

        // If the key does not exist, mark it as unique
        if (!existingKey) {
          isKeyUnique = true;
        }

        // Increase the key generation attempt counter
        keyAttempts++;
      }

      // If a unique admin key cannot be generated, return an error
      if (!isKeyUnique) {
        return res.status(500).json({
          status: "failed",
          message: "Failed to generate unique admin key. Please try again.",
        });
      }

      // --------------------------------------------------
      // CREATE APPROVED ADMIN ACCOUNT
      // --------------------------------------------------

      // Create a new admin document with the generated ID and security key
      const newAdmin = new adminModel({
        adminId: adminId,
        email: emailLower,
        adminKey: adminKey,
        name: name,
        phone: phone || "Not Provided", // Store a default value if phone is not provided
        isRequestApproved: true, // Automatically approve the authorized email
      });

      // Save the new admin document in the MongoDB database
      await newAdmin.save();

      // --------------------------------------------------
      // SEND ADMIN SECURITY KEY THROUGH EMAIL
      // --------------------------------------------------

      // Generate the HTML email content using the admin name,
      // generated security key, and configured sender email
      try {
        const emailHtml = adminKeyEmail(newAdmin.name, adminKey, process.env.EMAIL_FROM);

        // Try using Resend
        try {

          // Send the admin security key to the registered email address
          // through the configured Brevo email service
          info = await sendMailThroughBrevo({
            to: emailLower,
            subject: "Admin Access Key - Expense Management System",
            html: emailHtml,
          });

        } catch (error) {

          // Log the error if the email service fails to send the security key
          console.error("Email sending for admin security key failed. error:", error);

          // Return an error response when email sending fails
          return res.status(400).json({
            status: "failed",
            message: "Email sending for admin security key failed....!",
          });
        }

        // Return success after the admin account has been created
        // and the security key email has been sent
        return res.status(200).json({
          status: "success",
          message: "Admin access approved! A security key has been sent to your email address.",
        });

      } catch (emailError) {

        // Log any unexpected error occurring during email generation or sending
        console.error("Email sending error:", emailError);

        // Still return success as admin is created, but log the error
        // Include the generated key in the response for development/testing
        return res.status(200).json({
          status: "success",
          message: "Admin access approved! However, there was an issue sending the email. Please contact support.",
          adminKey: adminKey, // Include key in response for development/testing
        });
      }

    } else {

      // --------------------------------------------------
      // CREATE ADMIN REQUEST WITHOUT AUTOMATIC APPROVAL
      // --------------------------------------------------

      // If the email is not in the authorized list,
      // create an admin record with approval status set to false
      const newAdmin = new adminModel({
        adminId: adminId,
        email: emailLower,
        name: name,
        phone: phone || "Not Provided",

        // Mark the request as pending approval
        isRequestApproved: false,

        // adminKey will be null/undefined for unapproved requests
      });

      // Save the pending admin request in the database
      await newAdmin.save();

      // Inform the user that the request has been received
      return res.status(200).json({
        status: "success",
        message: "Thank you for your request. Our team has received it and will contact you via email shortly.",
      });
    }

  } catch (error) {

    // Log unexpected errors occurring during the admin access request process
    console.error("Request admin access error:", error);

    // Return a server error response if the request cannot be processed
    return res.status(500).json({
      status: "failed",
      message: "Failed to process admin access request.",
      error: error.message,
    });
  }
};


// ======================================================
// ADMIN LOGIN
// ======================================================

// This function authenticates an admin using their registered email
// and 16-character admin security key.

const adminLogin = async (req, res) => {
  try {

    // Extract email and admin security key from the request body
    const { email, adminKey } = req.body;

    // Check whether both required login fields are provided
    if (!email || !adminKey) {
      return res.status(400).json({
        status: "failed",
        message: "Email and admin key are required!",
      });
    }

    // Validate the email address format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: "failed",
        message: "Please provide a valid email address!",
      });
    }

    // Validate the admin security key format
    // The key must contain exactly 16 uppercase letters or numbers
    if (!/^[A-Z0-9]{16}$/.test(adminKey)) {
      return res.status(400).json({
        status: "failed",
        message: "Admin key must be exactly 16 uppercase alphanumeric characters!",
      });
    }

    // Find the admin using the normalized email and provided security key
    // Only approved admin accounts are allowed to log in
    const admin = await adminModel.findOne({
      email: email.toLowerCase().trim(),
      adminKey: adminKey,
      isRequestApproved: true, // Only allow login if request is approved
    });

    // If no matching approved admin is found, reject the login request
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid email or admin key, or your request has not been approved yet!",
      });
    }

    // Check whether the admin account is currently active
    if (!admin.isActive) {
      return res.status(403).json({
        status: "failed",
        message: "Your account is deactivated. Please mail us with your registered email id to activate your admin account and get a new security key.",
      });
    }

    // Update the lastLogin field with the current date and time
    admin.lastLogin = new Date();

    // Save the updated login information in the database
    await admin.save();

    // Return successful login response
    // Do not expose sensitive information such as the admin security key
    return res.status(200).json({
      status: "success",
      message: "Admin login successful!",
      admin: {
        adminId: admin.adminId,
        email: admin.email,
        name: admin.name,
      },
    });

  } catch (error) {

    // Log any unexpected errors during the admin login process
    console.error("Admin login error:", error);

    // Return an internal server error response
    return res.status(500).json({
      status: "failed",
      message: "Failed to process admin login.",
      error: error.message,
    });
  }
};


// ======================================================
// GET DASHBOARD DATA
// ======================================================

// This function retrieves dashboard information for an active admin.
// It fetches registered users and their transaction details,
// then calculates overall user and transaction statistics.

const getDashboardData = async (req, res) => {
  try {

    // Extract admin ID from the request body
    const { adminId } = req.body;

    // Validate whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Verify that the admin exists, is active, and has approved access
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true,
      isRequestApproved: true, // Only allow approved admins to access dashboard
    });

    // If the admin does not exist or is not authorized, deny access
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid or inactive admin ID, or your request has not been approved yet!",
      });
    }

    // --------------------------------------------------
    // FETCH REGISTERED USERS
    // --------------------------------------------------

    // Fetch all email-registered users from MongoDB
    // Sort records by creation date in descending order (newest first)
    const emailUsers = await userModel.find({}).sort({ createdAt: -1 });

    // Fetch all Google-authenticated users from MongoDB
    // Sort records by creation date in descending order
    const googleUsers = await GoogleAuthUserModel.find({}).sort({ createdAt: -1 });

    // Fetch all transactions stored in the transaction collection
    const transactions = await transectionModel.find({});

    // --------------------------------------------------
    // CALCULATE TRANSACTION DATA FOR EACH USER
    // --------------------------------------------------

    // Create an empty object to store transaction totals for each user
    const userTransactionMap = {};

    // Loop through every transaction retrieved from the database
    transactions.forEach((transaction) => {

      // Get the user ID associated with the current transaction
      const userId = transaction.expenseAppUserId;

      // If this user does not already exist in the map,
      // initialize their income, expense, and turnover totals
      if (!userTransactionMap[userId]) {
        userTransactionMap[userId] = {
          totalIncome: 0,
          totalExpense: 0,
          totalTurnover: 0,
        };
      }

      // Check whether the current transaction represents income
      // Support both uppercase and lowercase transaction types
      if (transaction.type === "Income" || transaction.type === "income") {

        // Add the transaction amount to the user's total income
        userTransactionMap[userId].totalIncome += transaction.amount;

      } else if (transaction.type === "Expense" || transaction.type === "expense") {

        // Add the transaction amount to the user's total expenses
        userTransactionMap[userId].totalExpense += transaction.amount;
      }

      // Add the transaction amount to total turnover
      // This includes both income and expense transactions
      userTransactionMap[userId].totalTurnover += transaction.amount;
    });

    // --------------------------------------------------
    // FORMAT EMAIL REGISTERED USERS
    // --------------------------------------------------

    // Convert email-registered user documents into dashboard objects
    const emailUsersWithData = emailUsers.map((user) => {

      // Retrieve transaction totals using the user's unique ID
      // If no transactions exist, initialize all totals to zero
      const transactionData = userTransactionMap[user.expenseAppUserId] || {
        totalIncome: 0,
        totalExpense: 0,
        totalTurnover: 0,
      };

      // Return a formatted object containing user and transaction information
      return {
        userId: user.expenseAppUserId,
        email: user.email,

        // Return null if the phone number has not been provided
        phone: user.phoneNumber !== "Not Provided" ? user.phoneNumber : null,

        isVerified: user.isVerified,
        createdDate: user.createdAt,

        // Include the user's calculated financial information
        totalTurnover: transactionData.totalTurnover,
        totalIncome: transactionData.totalIncome,
        totalExpense: transactionData.totalExpense,

        // Identify the user's registration method
        registeredWith: "EMAIL",

        // Additional user details
        name: user.name,
        address: user.address !== "Not Provided" ? user.address : null,
        favoriteSport: user.favouriteSport !== "Not Provided" ? user.favouriteSport : null,
        gender: user.gender !== "Not Provided" ? user.gender : null,
      };
    });

    // --------------------------------------------------
    // FORMAT GOOGLE AUTHENTICATED USERS
    // --------------------------------------------------

    // Convert Google-authenticated user documents into dashboard objects
    const googleUsersWithData = googleUsers.map((user) => {

      // Retrieve transaction totals using the user's unique ID
      // Use zero as the default if the user has no transactions
      const transactionData = userTransactionMap[user.expenseAppUserId] || {
        totalIncome: 0,
        totalExpense: 0,
        totalTurnover: 0,
      };

      // Return a formatted object containing Google user details
      return {
        userId: user.expenseAppUserId,
        email: user.email,

        // Return null if the phone number is not available
        phone: user.phoneNumber !== "Not Provided" ? user.phoneNumber : null,

        isVerified: user.isVerified,
        createdDate: user.createdAt,

        // Include calculated transaction information
        totalTurnover: transactionData.totalTurnover,
        totalIncome: transactionData.totalIncome,
        totalExpense: transactionData.totalExpense,

        // Identify the registration method as Google
        registeredWith: "GOOGLE",

        // Additional user details
        name: user.name,
        address: user.address !== "Not Provided" ? user.address : null,
        favoriteSport: user.favouriteSport !== "Not Provided" ? user.favouriteSport : null,
        gender: user.gender !== "Not Provided" ? user.gender : null,
      };
    });

    // --------------------------------------------------
    // COMBINE AND SORT BOTH USER TYPES
    // --------------------------------------------------

    // Combine email users and Google users into a single array
    // Sort all users by registration date, with newest users first
    const usersWithData = [...emailUsersWithData, ...googleUsersWithData].sort(
      (a, b) => new Date(b.createdDate) - new Date(a.createdDate)
    );

    // --------------------------------------------------
    // CALCULATE DASHBOARD SUMMARY
    // --------------------------------------------------

    // Calculate the total number of registered users
    const totalUsers = usersWithData.length;

    // Calculate the combined turnover of all registered users
    // reduce() adds each user's turnover to the running total
    const totalTurnover = usersWithData.reduce((sum, user) => sum + user.totalTurnover, 0);

    // Return the dashboard information and summary statistics
    return res.status(200).json({
      status: "success",
      message: "Dashboard data fetched successfully!",
      data: {
        summary: {
          totalUsers,
          totalTurnover,
        },
        users: usersWithData,
      },
    });

  } catch (error) {

    // Log errors that occur while retrieving dashboard information
    console.error("Get dashboard data error:", error);

    // Return an error response if dashboard data cannot be retrieved
    return res.status(500).json({
      status: "failed",
      message: "Failed to fetch dashboard data.",
      error: error.message,
    });
  }
};


// ======================================================
// GET ADMIN PROFILE
// ======================================================

// This function retrieves the profile information of an active admin.

const getAdminProfile = async (req, res) => {
  try {

    // Extract the admin ID from the request body
    const { adminId } = req.body;

    // Check whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Find the admin account using the provided ID
    // Only active admin accounts are considered
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true,
    });

    // Return an unauthorized response if the admin does not exist
    // or the account has been deactivated
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid or inactive admin key!",
      });
    }

    // Return the admin's profile information
    // Sensitive information such as the admin security key is excluded
    return res.status(200).json({
      status: "success",
      message: "Admin profile fetched successfully!",
      admin: {
        adminId: admin.adminId,
        email: admin.email,
        name: admin.name,
        phone: admin.phone,

        // Return false if phone verification status is not available
        isPhoneVerified: admin.isPhoneVerified || false,

        isRequestApproved: admin.isRequestApproved,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
      },
    });

  } catch (error) {

    // Log errors occurring while retrieving the admin profile
    console.error("Get admin profile error:", error);

    // Return an internal server error response
    return res.status(500).json({
      status: "failed",
      message: "Failed to fetch admin profile.",
      error: error.message,
    });
  }
};


// ======================================================
// UPDATE ADMIN PHONE NUMBER
// ======================================================

// This function allows an active admin to update their registered phone number.

const updateAdminPhone = async (req, res) => {
  try {

    // Extract admin ID and new phone number from the request body
    const { adminId, phone } = req.body;

    // Validate whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Validate the phone number only when a non-empty value is provided
    // "Not Provided" is treated as a default value rather than a phone number
    if (phone && phone.trim() !== "" && phone !== "Not Provided") {

      // Define a regular expression to check the basic phone number format
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

      // Test the trimmed phone number against the regular expression
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({
          status: "failed",
          message: "Please provide a valid phone number format!",
        });
      }
    }

    // Find the admin account using the provided ID
    // Only active admin accounts can update their phone number
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true,
    });

    // If the admin does not exist or is inactive, stop execution
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid or inactive admin ID!",
      });
    }

    // Update the admin's phone number
    // Remove unnecessary spaces from the provided number
    // If no number is provided, store the default value
    admin.phone = phone && phone.trim() !== "" ? phone.trim() : "Not Provided";

    // Save the updated admin information in MongoDB
    await admin.save();

    // Return the updated admin profile information
    return res.status(200).json({
      status: "success",
      message: "Phone number updated successfully!",
      admin: {
        adminId: admin.adminId,
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        isRequestApproved: admin.isRequestApproved,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
      },
    });

  } catch (error) {

    // Log errors occurring during the phone number update process
    console.error("Update admin phone error:", error);

    // Return an internal server error response
    return res.status(500).json({
      status: "failed",
      message: "Failed to update phone number.",
      error: error.message,
    });
  }
};


// ======================================================
// SEND OTP FOR ADMIN PHONE VERIFICATION
// ======================================================

// This function generates a six-digit OTP and sends it to the admin's
// phone number through the Fast2SMS external SMS service.

const sendOTPForAdminPhoneVerification = async (req, res) => {
  try {

    // Extract admin ID and phone number from the request body
    const { adminId, phoneNumber } = req.body;

    // Check whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Check whether phone number is provided
    if (!phoneNumber) {
      return res.status(400).json({
        status: "failed",
        message: "Phone number field required...!",
      });
    }

    // Define a regular expression to validate the phone number format
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

    // Validate the trimmed phone number
    if (!phoneRegex.test(phoneNumber.trim())) {
      return res.status(400).json({
        status: "failed",
        message: "Please provide a valid phone number format!",
      });
    }

    // Check whether the admin exists and the account is active
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true,
    });

    // Reject the request if the admin account is not found or inactive
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid or inactive admin ID!",
      });
    }

    // --------------------------------------------------
    // GENERATE SIX-DIGIT OTP
    // --------------------------------------------------

    // Generate a random six-digit numeric OTP
    // The range starts from 100000 to ensure exactly six digits
    const OTP = Math.floor(100000 + Math.random() * 900000);

    // --------------------------------------------------
    // PREPARE SMS MESSAGE
    // --------------------------------------------------

    // Create the SMS request data containing sender ID,
    // OTP message, language, route, and recipient phone number
    const messageData = {
      sender_id: "FSTSMS",
      message: `Your OTP for phone number verification is ${OTP} - Expense Management System (Admin).`,
      language: "english",
      route: "q",
      numbers: phoneNumber,
    };

    // --------------------------------------------------
    // SEND OTP THROUGH FAST2SMS API
    // --------------------------------------------------

    try {

      // Make a POST request to the Fast2SMS API
      // Send the SMS message data and authenticate using the API key
      const response = await axios.post(
        "https://www.fast2sms.com/dev/bulkV2",
        messageData,
        {
          headers: {
            Authorization: process.env.FAST2SMS_API_KEY,
          },
        }
      );

      // Display the SMS API response in the server console
      console.log("SMS Response: ", response);

    } catch (smsError) {

      // Log the SMS sending error if the external service fails
      console.error("SMS sending error:", smsError);

      // Continue even if SMS fails (for development/testing)
    }

    // --------------------------------------------------
    // SAVE OR UPDATE OTP IN DATABASE
    // --------------------------------------------------

    // Check whether the phone number already exists in the admin phone collection
    const existingPhone = await AdminPhoneNumberModel.findOne({
      phoneNumber: phoneNumber,
    });

    if (existingPhone) {

      // If a record already exists, update it with the newly generated OTP
      existingPhone.otp = String(OTP);

      // Reset verification status because a new OTP has been generated
      existingPhone.isVerified = false;

      // Associate the phone record with the current admin
      existingPhone.adminId = adminId;

      // Save the updated phone record
      await existingPhone.save();

    } else {

      // If the phone number does not exist, create a new database record
      const newAdminPhoneNumber = new AdminPhoneNumberModel({
        phoneNumber: phoneNumber,

        // Convert the numeric OTP into a string before storing it
        otp: String(OTP),

        // Link the phone number record to the admin account
        adminId: adminId,

        // Initially mark the phone number as unverified
        isVerified: false,
      });

      // Save the new phone number record in MongoDB
      await newAdminPhoneNumber.save();
    }

    // Return a successful response indicating that the OTP process was completed
    return res.status(200).json({
      status: "success",
      message: "OTP sent successfully. Check your phone and verify with your OTP...!",
      phoneNumber: phoneNumber,
    });

  } catch (error) {

    // Log unexpected errors occurring during OTP generation or database operations
    console.error("Send admin phone OTP error:", error);

    // Return an error response if the OTP process fails
    return res.status(500).json({
      status: "failed",
      message: "Something went wrong in sending OTP for phone number verification...!",
      error: error.message,
    });
  }
};


// ======================================================
// VERIFY ADMIN PHONE OTP
// ======================================================

// This function verifies the OTP entered by the admin.
// After successful verification, it updates the admin's phone number
// and marks the phone number as verified in the database.

const verifyAdminPhoneOTP = async (req, res) => {
  try {

    // Extract admin ID, phone number, and OTP from the request body
    const { adminId, phoneNumber, otp } = req.body;

    // --------------------------------------------------
    // VALIDATE REQUIRED INPUTS
    // --------------------------------------------------

    // Check whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Check whether both phone number and OTP are provided
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        status: "failed",
        message: "Phone number and OTP are required...!",
      });
    }

    // --------------------------------------------------
    // VERIFY ADMIN ACCOUNT
    // --------------------------------------------------

    // Find the admin account using the provided ID
    // Only active admin accounts are allowed to verify phone numbers
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true,
    });

    // Reject the request if the admin account is not found or inactive
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid or inactive admin ID!",
      });
    }

    // --------------------------------------------------
    // FIND AND VALIDATE OTP
    // --------------------------------------------------

    // Find the phone number record associated with the provided admin ID
    const phoneRecord = await AdminPhoneNumberModel.findOne({
      phoneNumber: phoneNumber,
      adminId: adminId,
    });

    // If no matching phone record exists, return an invalid OTP response
    if (!phoneRecord) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid or Expired OTP...!",
      });
    }

    // Compare the submitted OTP with the OTP stored in the database
    // Convert the submitted OTP to a string for comparison
    if (phoneRecord.otp !== String(otp)) {
      return res.status(400).json({
        status: "failed",
        message: "Invalid or Expired OTP...!",
      });
    }

    // --------------------------------------------------
    // UPDATE ADMIN PHONE NUMBER
    // --------------------------------------------------

    // Update the admin account with the verified phone number
    admin.phone = phoneNumber.trim();

    // Mark the admin's phone number as verified
    admin.isPhoneVerified = true;

    // Save the updated admin information in MongoDB
    await admin.save();

    // --------------------------------------------------
    // UPDATE PHONE VERIFICATION RECORD
    // --------------------------------------------------

    // Mark the phone number record as verified
    phoneRecord.isVerified = true;

    // Replace the stored OTP with the string "null"
    // This prevents the same OTP from matching again
    phoneRecord.otp = "null";

    // Save the updated phone verification record
    await phoneRecord.save();

    // Return a successful response with the updated admin information
    return res.status(200).json({
      status: "success",
      message: "Phone number verified and updated successfully!",
      admin: {
        adminId: admin.adminId,
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        isPhoneVerified: admin.isPhoneVerified,
        isRequestApproved: admin.isRequestApproved,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: admin.lastLogin,
      },
    });

  } catch (error) {

    // Log errors occurring during OTP verification
    console.error("Verify admin phone OTP error:", error);

    // Return an internal server error response
    return res.status(500).json({
      status: "failed",
      message: "Failed to verify phone number.",
      error: error.message,
    });
  }
};


// ======================================================
// DEACTIVATE ADMIN ACCOUNT
// ======================================================

// This function allows an active admin to deactivate their account.
// After successful deactivation, the account's isActive status becomes false.

const deactivateAdminAccount = async (req, res) => {
  try {

    // Extract the admin ID from the request body
    const { adminId } = req.body;

    // Validate whether admin ID is provided
    if (!adminId) {
      return res.status(400).json({
        status: "failed",
        message: "Admin ID is required!",
      });
    }

    // Find the admin account using the provided ID
    // Only currently active admin accounts can be deactivated
    const admin = await adminModel.findOne({
      adminId: adminId,
      isActive: true, // Only allow deactivation if currently active
    });

    // If the admin does not exist or is already deactivated,
    // return an unauthorized response
    if (!admin) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid admin ID or account is already deactivated!",
      });
    }

    // Change the admin account status to inactive
    admin.isActive = false;

    // Save the updated account status in MongoDB
    await admin.save();

    // Return a successful response confirming account deactivation
    return res.status(200).json({
      status: "success",
      message: "Your admin account has been deactivated successfully. You will be logged out.",
    });

  } catch (error) {

    // Log errors occurring during the admin account deactivation process
    console.error("Deactivate admin account error:", error);

    // Return an internal server error response
    return res.status(500).json({
      status: "failed",
      message: "Failed to deactivate admin account.",
      error: error.message,
    });
  }
};


// ======================================================
// EXPORT ADMIN CONTROLLER FUNCTIONS
// ======================================================

// Export all controller functions so they can be imported
// and used in the application's admin routes

module.exports = {
  requestAdminAccess,
  adminLogin,
  getDashboardData,
  getAdminProfile,
  updateAdminPhone,
  sendOTPForAdminPhoneVerification,
  verifyAdminPhoneOTP,
  deactivateAdminAccount,
};