const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    const mongoUri = (process.env.MONGO_URI || '').replace('mongodb://localhost', 'mongodb://127.0.0.1')
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    })
    console.log(`MongoDB connected: ${conn.connection.host}`)
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
