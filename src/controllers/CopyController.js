const mongoose = require("mongoose");
const Book = require("../models/Book");
const Copy = require("../models/Copy");


const createCopy = async (req, res) => {
  try {
    const { bookId, inventoryCode } = req.body;

    
    if (
      typeof bookId !== "string" ||
      !mongoose.isValidObjectId(bookId) ||
      typeof inventoryCode !== "string" ||
      !inventoryCode.trim()
    ) {
      return res.status(400).json({
        message: "Valid bookId and inventoryCode are required"
      });
    }

   
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    const existingCopy = await Copy.findOne({
      inventoryCode: inventoryCode.trim()
    });

    if (existingCopy) {
      return res.status(409).json({
        message: "Inventory code already exists"
      });
    }

    const copy = await Copy.create({
      bookId,
      inventoryCode: inventoryCode.trim()
    });

    return res.status(201).json({
      message: "Copy created successfully",
      copy
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Inventory code already exists"
      });
    }

    console.error("Create copy error:", error.message);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


const getCopies = async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
      return res.status(400).json({
        message: "Invalid book ID"
      });
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    const copies = await Copy.find({ bookId });

    return res.status(200).json(copies);

  } catch (error) {
    console.error("Get copies error:", error.message);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

module.exports = {
  createCopy,
  getCopies
};