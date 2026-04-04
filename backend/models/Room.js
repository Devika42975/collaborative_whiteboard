const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'Untitled Room',
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    strokes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stroke',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Room', roomSchema)