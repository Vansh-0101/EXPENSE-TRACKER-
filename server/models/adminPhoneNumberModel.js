
const mongoose = require("mongoose"); // Import Mongoose to work with MongoDB.

// Create a schema for storing admin phone number verification details.
const adminPhoneNumberSchema = new mongoose.Schema(
  {
    phoneNumber: { // Store the admin's phone number.
      type: String, // Phone number will be stored as a string.
      required: true, // Phone number is mandatory.
    },

    otp: { // Store the OTP sent to the admin's phone.
      type: String, // OTP will be stored as a string.
      required: true, // OTP is mandatory.
    },

    isVerified: { // Check whether the phone number is verified.
      type: Boolean, // Store verification status as true or false.
      default: false, // By default, the phone number is not verified.
    },

    adminId: { // Store the ID of the associated admin.
      type: String, // Admin ID will be stored as a string.
      required: true, // Admin ID is mandatory.
      ref: "admins", // Reference to the admins collection/model.
    },
  },
  { timestamps: true } // Automatically create createdAt and updatedAt fields.
);

// This model is used for VANSH's admin phone number verification through OTP.
const AdminPhoneNumberModel = mongoose.model(
  "adminphonenumbers", // Name of the MongoDB collection/model.
  adminPhoneNumberSchema // Attach the schema to this model.
);

// Export the model so it can be used in other files.
module.exports = AdminPhoneNumberModel;
