const Book = require("../models/Book");
const mongoose = require("mongoose");
const Copy = require("../models/Copy");
const Loan = require("../models/Loan");

async function addAvailability(books) {
  const copies = await Copy.find({ bookId: { $in: books.map(book => book._id) } }).lean();
  const active = await Loan.find({ copyId: { $in: copies.map(copy => copy._id) }, returnedAt: null }).distinct("copyId");
  const borrowed = new Set(active.map(id => String(id)));
  return books.map(book => {
    const bookCopies = copies.filter(copy => String(copy.bookId) === String(book._id))
      .map(copy => ({ ...copy, available: !borrowed.has(String(copy._id)) }));
    return { ...book.toObject(), copies: bookCopies, availableCopies: bookCopies.filter(copy => copy.available).length };
  });
}


const createBook = async (req, res) => {
  try {
    const { title, author, description } = req.body || {};

    if (typeof title !== "string" || !title.trim() || typeof author !== "string" || !author.trim() ||
        (description !== undefined && typeof description !== "string")) {
      return res.status(400).json({
        message: "Title and author are required"
      });
    }

    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
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

    if (search !== undefined && (typeof search !== "string" || search.length > 100)) return res.status(400).json({ message: "Invalid search" });
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      books = await Book.find({
        $or: [
          { title: { $regex: safeSearch, $options: "i" } },
          { author: { $regex: safeSearch, $options: "i" } }
        ]
      });
    } else {
      books = await Book.find();
    }

    res.status(200).json(await addAvailability(books));

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

    res.status(200).json((await addAvailability([book]))[0]);

  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
};



const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description } = req.body || {};

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

    if ((title !== undefined && (typeof title !== "string" || !title.trim())) ||
        (author !== undefined && (typeof author !== "string" || !author.trim())) ||
        (description !== undefined && typeof description !== "string")) return res.status(400).json({ message: "Invalid book data" });
    if (title !== undefined) book.title = title.trim();
    if (author !== undefined) book.author = author.trim();
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
