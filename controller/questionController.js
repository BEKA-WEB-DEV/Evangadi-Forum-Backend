const express = require("express");
const { StatusCodes } = require("http-status-codes");
const crypto = require("crypto");
const KeywordExtractor = require("keyword-extractor");
// Initialize App
const app = express();
const dbConnection = require("../db/dbConfig");
// const multer = require("multer");
// const upload = multer({ dest: "uploads/" }); // Specify upload directory

async function postQuestion(req, res) {
  const { title, description, tag } = req.body;
  const { userid } = req.user;

  const image = req.files?.image?.[0]?.path || null;
  const audio = req.files?.audio?.[0]?.path || null;

  // Validation
  if (!title || !description) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      msg: "Please provide all required fields: title and description.",
    });
  }

  if (!userid) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ msg: "User not authenticated." });
  }

  try {
    await dbConnection.query(
      "INSERT INTO questions (userid, title, description, tag, image, audio) VALUES (?, ?, ?, ?, ?, ?)",
      [userid, title, description, tag, image, audio]
    );
    return res
      .status(StatusCodes.CREATED)
      .json({ msg: "Question created successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ msg: "An error occurred while creating the question." });
  }
}

async function getSingleQuestion(req, res) {
  const { questionid } = req.params;

  if (!questionid) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ msg: "Invalid or missing question ID." });
  }

  try {
    // Fetch the question and related answers
    const [question] = await dbConnection.query(
      `SELECT * FROM questions WHERE questionid = ?`,
      [questionid]
    );

    if (question.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ msg: "Question not found" });
    }

    // Fetch the related answers
    const [answers] = await dbConnection.query(
      `SELECT a.answerid, a.answer, a.created_at, a.image, a.audio, 
              u.username
       FROM answers a 
       INNER JOIN users u ON a.userid = u.userid
       WHERE a.questionid = ?`,
      [questionid]
    );

    // Return both question and its answers
    return res.status(StatusCodes.OK).json({
      question: question[0],
      answers,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ msg: "An error occurred while fetching the question." });
  }
}

async function getAllQuestions(req, res) {
  const questionid = req.params.questionId;

  try {
    const [rows] = await dbConnection.query(
      `SELECT 
          q.questionid, 
          q.title, 
          q.description, 
          q.createdAt AS question_createdAt,
          u2.username as question_username,
          a.answerid, 
          a.userid AS answer_userid, 
          a.answer,
          a.createdAt,
          u.username as answer_username
       FROM 
          questions q   
       LEFT JOIN 
          answers a ON q.questionid = a.questionid
          LEFT JOIN users u on u.userid = a.userid
          left join users u2 on u2.userid = q.userid
       WHERE 
          q.questionid = ?
          order by a.createdAt desc
          `,
      [questionid]
    );

    // Check if the question exists
    if (rows.length === 0) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Question not found" });
    }

    // Reshape the data to include answers under the question
    const questionDetails = {
      id: rows[0].questionid,
      title: rows[0].title,
      description: rows[0].description,
      qtn_createdAt: rows[0].question_createdAt,
      qtn_username: rows[0].question_username,
      answers: rows
        .map((answer) => ({
          answerid: answer.answerid,
          userid: answer.answer_userid,
          username: answer.answer_username,
          answer: answer.answer,
          createdAt: answer.createdAt,
        }))
        .filter((answer) => answer.answerid !== null), // Filter out any null answers
    };

    res.status(StatusCodes.OK).json(questionDetails);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching question details" + error });
  }
}

module.exports = { getSingleQuestion, postQuestion, getAllQuestions };
