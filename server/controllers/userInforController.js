
// Import the Contact Us Message model.
// This model is used to create, find, and update contact messages
// stored in the MongoDB database.
const ContactUsMessageModel = require("../models/contactUsMessageModel");

// Import the Brevo email service.
// This service is used to send confirmation emails to users.
const sendMailThroughBrevo = require("../services/brevoEmailService");

// Import the email template for Contact Us message confirmation.
// This function generates the HTML content of the confirmation email.
const contactUsMessageSentSuccess = require("../utils/emailTemplates/contactUsMessageSent");

// Import customAlphabet from Nano ID.
// It helps generate unique IDs using a custom set of characters.
const { customAlphabet } = require("nanoid");

// Define the characters that can be used to generate unique IDs.
// It contains:
// 0-9: Numbers
// A-Z: Uppercase letters
// a-z: Lowercase letters
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// --------------------------------------------------
// 1. CONTACT US MESSAGE CONTROLLER
// --------------------------------------------------

// This function handles messages submitted through the Contact Us form.
// It performs the following operations:
// 1. Receives user details from the frontend.
// 2. Validates the required fields.
// 3. Checks whether the email already exists.
// 4. Updates an existing message or creates a new message.
// 5. Sends a confirmation email.
// 6. Returns an appropriate response to the frontend.
const contactUsMessageController = async (req, res) => {

  // Extract the name, email, and message from the request body.
  // These values are submitted by the user through the Contact Us form.
  const { name, email, message } = req.body;

  try {

    // Check whether all required fields are provided.
    // If any field is empty or missing, return a 400 Bad Request response.
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({
          status: "failed",
          message: "All fields are required...!"
        });
    }

    // Search for an existing Contact Us record using the user's email.
    // If a record with this email exists, findOne() returns that document.
    // Otherwise, it returns null.
    const user = await ContactUsMessageModel.findOne({ email });

    // Check whether the user has already submitted a Contact Us message.
    if (user) {

      // If a record already exists, update its name.
      user.name = name;

      // Update the email address.
      user.email = email;

      // Update the message with the newly submitted message.
      user.message = message;

      // Save the updated document in the MongoDB database.
      await user.save();

    } else {

      // If no existing record is found, create a new Contact Us record.

      // Generate a custom Nano ID generator.
      // The second argument (10) specifies that the generated ID
      // should contain exactly 10 characters.
      // The alphabet variable defines which characters can be used.
      // const nanoId = nanoid(10);

      const nanoid = customAlphabet(alphabet, 10);

      // Generate a unique ID for the Contact Us user.
      const nanoId = nanoid();

      // Print the generated ID in the server console for debugging.
      console.log("contactUsUserId: ", nanoId);

      // Create a new document using the Contact Us Message model.
      const newUser = new ContactUsMessageModel({

        // Store the generated unique ID.
        contactUsUserId: nanoId,

        // Store the user's name.
        name,

        // Store the user's email address.
        email,

        // Store the message submitted by the user.
        message,
      });

      // Save the newly created Contact Us record in MongoDB.
      await newUser.save();
    }

    // Fetch the latest Contact Us record using the user's email.
    // This retrieves the updated or newly created document.
    const updatedUser = await ContactUsMessageModel.findOne({
      email,
    });

    // --------------------------------------------------
    // 2. SEND CONFIRMATION EMAIL
    // --------------------------------------------------

    // Send a confirmation email to the user after saving the message.
    // The email confirms that the Contact Us message was submitted successfully.
    try {

      // Call the Brevo email service to send the confirmation email.
      info = await sendMailThroughBrevo({

        // Set the recipient email address.
        to: updatedUser.email,

        // Set the subject of the confirmation email.
        subject: "Your contact us message sent successfully.",

        // Generate the HTML email content.
        // Pass the updated user details and sender email address
        // to the email template function.
        html: contactUsMessageSentSuccess(
          updatedUser,
          process.env.EMAIL_FROM
        ) // Your HTML generator
      });

    } catch (error) {

      // If the email service fails, print the error in the server console.
      console.error(
        "Your contact us message mail failed to send...! Error:",
        error
      );

      // Return a 400 response if the confirmation email could not be sent.
      return res.status(400).json({
        status: "failed",
        message: "Your contact us message mail failed to send...!",
      });
    }

    // --------------------------------------------------
    // 3. SEND SUCCESS RESPONSE
    // --------------------------------------------------

    // Return a successful response after the message is saved
    // and the confirmation email is sent.
    return res.status(200).json({
      status: "success",
      message: "Message sent successfully...!",

      // Return the saved or updated Contact Us record.
      user: updatedUser,
    });

  } catch (error) {

    // Print unexpected errors in the server console for debugging.
    console.log(error);

    // Return a 500 Internal Server Error response
    // if an unexpected error occurs during the process.
    res.status(500).json({
      status: "failed",
      message: "Internel Server error. Can't send message...!",
    });
  }
};

// --------------------------------------------------
// 4. EXPORT CONTROLLER FUNCTION
// --------------------------------------------------

// Export the Contact Us controller function.
// This allows us to import it into the routes file
// and connect it with the appropriate API endpoint.
module.exports = {
  contactUsMessageController
};
