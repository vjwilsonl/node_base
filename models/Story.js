const mongoose = require('mongoose');
const { Schema } = mongoose;

const storySchema = new Schema(
  {
    title: String,
    description: String,
    imageUrl: String, //TODO remove this
    thumbnail: {
      url: String,
      key: String
    },
    status: String, //live, draft
    visibility: String, //public, private
    _user: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

mongoose.model('stories', storySchema);
