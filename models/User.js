const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    googleId: String,
    name: String,
    avatarURI: String,
    email: String
  },
  { timestamps: true }
);

mongoose.model('users', userSchema);
