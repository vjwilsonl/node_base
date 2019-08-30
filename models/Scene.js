const mongoose = require('mongoose');
const { Schema } = mongoose;

const sceneSchema = new Schema(
  {
    vrImage: {
      url: String,
      key: String
    },
    backgroundColor: String, // color hexcode
    template: String, // 1, 2, 3, 4
    name: String,
    _story: { type: mongoose.SchemaTypes.ObjectId, ref: 'Story' },
    _user: { type: mongoose.SchemaTypes.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

mongoose.model('scenes', sceneSchema);
