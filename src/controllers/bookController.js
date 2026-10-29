const Book = require("../models/Book");
const mongoose = require("mongoose");


const createBook = async (req, res) => {
  try {
    const { title, author, description } = req.body;

    if (!title || !author) {
      return res.status(400).json({
        message: "Title and author are required"
      });
    }

    const book = await Book.create({
      title,
      author,
      description
    });

    res.status(201).json({
      message: "Book created successfully",
      book
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};



const getBooks = async (req, res) => {
  try {
    const { search } = req.query;

    let books;

    if (search) {
      books = await Book.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } }
        ]
      });
    } else {
      books = await Book.find();
    }

    res.status(200).json(books);

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};


const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid book ID"
      });
    }

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    res.status(200).json(book);

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};



const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid book ID"
      });
    }

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (description !== undefined) book.description = description;

    await book.save();

    res.status(200).json({
      message: "Book updated successfully",
      book
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};



module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook
};