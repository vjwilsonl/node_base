const mongoose = require('mongoose');
const { Schema } = mongoose;

const storySchema = new Schema({
  title: String,
  description: String,
  imageUrl: String,
  _user: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' }
});

mongoose.model('stories', storySchema);
