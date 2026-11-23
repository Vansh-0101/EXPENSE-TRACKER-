const mongoose = require("mongoose"); // Import Mongoose to work with MongoDB.

// Create a Mongoose schema for storing admin phone number verification details.
// A schema defines the structure, data types, and validation rules
// for documents stored in the MongoDB collection.
const adminPhoneNumberSchema = new mongoose.Schema(
  {
    phoneNumber: { // Store the admin's phone number.
      type: String, // Phone number will be stored as a string.
      required: true, // Phone number is mandatory and cannot be empty.
    },

    otp: { // Store the OTP (One-Time Password) sent to the admin's phone.
      type: String, // OTP is stored as a string to preserve leading zeros.
      required: true, // OTP is mandatory for the verification process.
    },

    isVerified: { // Check whether the admin's phone number has been verified.
      type: Boolean, // Store verification status as true or false.
      default: false, // Initially, the phone number is considered unverified.
    },

    adminId: { // Store the ID of the admin associated with this phone number.
      type: String, // Admin ID will be stored as a string.
      required: true, // Every phone verification record must belong to an admin.
      ref: "admins", // Reference to the admins model.
                 // This reference can be used with Mongoose populate()
                 // to retrieve the related admin document.
    },
  },

  // Schema options.
  // timestamps: true automatically creates and maintains:
  // createdAt: Date and time when the verification record was created.
  // updatedAt: Date and time when the verification record was last updated.
  { timestamps: true }
);

// Create a Mongoose model named "adminphonenumbers".
// This model is used to perform database operations on the admin phone
// number verification collection.
const AdminPhoneNumberModel = mongoose.model(
  "adminphonenumbers", // Name of the MongoDB collection/model.
  adminPhoneNumberSchema // Attach the schema to this model.
);

// Export the model so it can be imported and used
// in controllers and other parts of the application.
module.exports = AdminPhoneNumberModel;
