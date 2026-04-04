const mongoose = require('mongoose')

const pointSchema = new mongoose.Schema(
  {
    x: {
      type: Number,
      required: true,
    },
    y: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  }
)

const strokeSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tool: {
      type: String,
      enum: ['pen', 'eraser'],
      default: 'pen',
    },
    color: {
      type: String,
      default: '#000000',
      trim: true,
    },
    brushSize: {
      type: Number,
      default: 3,
      min: 1,
    },
    points: {
      type: [pointSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Stroke', strokeSchema)