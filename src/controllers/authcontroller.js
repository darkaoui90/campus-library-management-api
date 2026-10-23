const User = require("../src/models/User");

const register = async (req, res) => {
  try {
    // 1. Get user information
    const { name, email, password } = req.body;

    // 2. Validate fields
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Valid name, email and password (min 8 characters) are required"
      });
    }

    // 3. Normalize and validate email
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }

    // 4. Check if email already exists
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    // 5. Create new user
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: "learner"
    });

    // 6. Save user to MongoDB
    await user.save();

    // 7. Return successful response
    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    // Handle duplicate email race conditions
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid user data"
      });
    }

    console.error("Registration failed:", error.name);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

module.exports = { register };