const path = require('path');
const multer = require('multer');
const CustomError = require('./CustomError');
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'tmp/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, callback) => {
    var ext = file.mimetype;
    // TODO limit upload size
    if (ext != 'image/png' && ext != 'image/jpg' && ext != 'image/jpeg') {
      return callback(
        new CustomError(
          '422',
          'Invalid image file. Please upload png|jpg|jpeg only.'
        )
        // new Error('Invalid image file. Please upload png|jpg|jpeg only.')
      );
      // return callback('Image must be png/jpg/jpeg', false);
    }
    callback(null, true);
  }
});
module.exports.uploadImage = uploadImage;
