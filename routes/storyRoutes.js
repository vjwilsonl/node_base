const passport = require('passport');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const keys = require('../config/keys');
const User = mongoose.model('users');
const Story = mongoose.model('stories');
//check file type
const readChunk = require('read-chunk');
const fileType = require('file-type');

const AWS = require('aws-sdk');
//configuring the AWS environment
AWS.config.update({
  accessKeyId: keys.awsAccessKeyID,
  secretAccessKey: keys.awsSecretKey
});

//file upload lib
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'tmp/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

module.exports = app => {
  app.post('/api/story', upload.single('vrfile'), (req, res) => {
    const { title, description } = req.body;
    var s3 = new AWS.S3();

    if (req.file) {
      var filePath = process.cwd() + '/' + req.file.path;
      const buffer = readChunk.sync(filePath, 0, fileType.minimumBytes);

      var fileMeta = fileType(buffer);
      //configuring file paremeters
      var params = {
        Bucket: 'tusi360',
        Body: fs.createReadStream(filePath),
        Key: 'storyimage/' + Date.now() + '_' + path.basename(filePath),
        ACL: 'public-read',
        ContentType: fileMeta.mime
      };
      s3.upload(params, async (err, data) => {
        if (err) {
          res.send('Error', err);
        }

        if (data) {
          var vrx = new Story({
            title,
            description,
            imageUrl: data.Location,
            _user: '5c7f539b7c34db3024c6795b'
          });
          try {
            await vrx.save();
            res.send(vrx);
          } catch (err) {
            res.status(422).send(err);
          }
          fs.unlink(filePath);
        }
      });
    } else {
      //no file uploaded
      res.send('Please upload an image');
    }
  });
  app.get('/api/story', async (req, res) => {
    const story = await Story.find({ _user: req.user.id });
    res.send(story);
  });
};
