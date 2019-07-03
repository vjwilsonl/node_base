/**
 *
 * @storyRoutes.js
 * Provides API end points for Story
 *
 */
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

/**
 * file upload library
 */
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

function uploadFileParams(filePath) {
  const buffer = readChunk.sync(filePath, 0, fileType.minimumBytes);
  var fileMeta = fileType(buffer);
  /**
   * configuring file parameters
   */
  var params = {
    Bucket: 'tusi360',
    Body: fs.createReadStream(filePath),
    Key: 'storyimage/' + Date.now() + '_' + path.basename(filePath),
    ACL: 'public-read',
    ContentType: fileMeta.mime
  };
  //begin uploading
  return params;
  // return s3.upload(params, (err, data) => {
  //   console.log('hehehehe');
  //   resolve('test');
  // });
  // , (err, data)
  //  => {
  //   if (err) {
  //     res.send('Error', err);
  //   }
  //   if (data) {
  //     fs.unlink(filePath);
  //     console.log(data, 'this is function data');
  //     return data;
  //   }
  // });
}

module.exports = app => {
  /**
   * POST /api/story
   * Create new story
   */
  app.post('/api/story', upload.single('vrfile'), async (req, res) => {
    const { title, description } = req.body;

    if (req.file) {
      const filePath = process.cwd() + '/' + req.file.path;
      const params = uploadFileParams(filePath);
      var fileData = '';
      var s3 = new AWS.S3();
      //begin upload
      await s3.upload(params, async (err, data) => {
        if (err) {
          // error in upload
          res.send('Error', err);
        } else if (data) {
          console.log(filePath);
          //temp fix
          var uid =
            typeof req.user !== 'undefined'
              ? req.user.id
              : '5c7f539b7c34db3024c6795b';
          fs.unlinkSync(filePath);
          var story = await new Story({
            title,
            description,
            imageUrl: data.Location,
            _user: uid
          }).save();
          //respond with newest copy of story created
          res.send(story);
        }
      });
    } else {
      //no file uploaded
      res.send('Please upload an image');
    }
  });

  /**
   * GET /api/story
   * Retrieve story list
   */
  app.get('/api/story', async (req, res) => {
    const story = await Story.find({ _user: req.user.id }).select('-_user');
    res.send(story);
  });

  /**
   * GET /api/story/:id
   * Retrieve story details
   */
  app.get('/api/story/:id', async (req, res) => {
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      try {
        var story = await Story.findById(req.params.id);
      } catch (err) {
        res.status(422).send(err);
      }
      res.send(story);
    } else {
      res.send('Invalid story ID');
    }
    // Need to control user based story
  });
  /**
   * POST /api/story/:id
   * UPDATE story details
   */
  app.post('/api/story/:id', upload.single('vrfile'), async (req, res) => {
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      // TODO check if story belong to user
      var { title, description } = req.body;
      var update = { title: title, description: description };
      var option = { new: true }; // return newest copy
      // check if new file uploaded
      if (req.file) {
        const filePath = process.cwd() + '/' + req.file.path;
        const params = uploadFileParams(filePath);
        var fileData = '';
        var s3 = new AWS.S3();
        //begin upload
        await s3.upload(params, async (err, data) => {
          if (err) {
            // error in upload
            res.send('Error', err);
          } else if (data) {
            //temp fix
            var uid =
              typeof req.user !== 'undefined'
                ? req.user.id
                : '5c7f539b7c34db3024c6795b';
            fs.unlinkSync(filePath);
            update.imageUrl = data.Location;
            try {
              var story = await Story.findByIdAndUpdate(
                req.params.id,
                update,
                option
              );
            } catch (err) {
              res.status(422).send(err);
            }

            if (story) {
              res.send(story);
            } else {
              res.status(204).send(story);
            }
          }
        });
      } else {
        // update new datas
        try {
          var story = await Story.findByIdAndUpdate(
            req.params.id,
            update,
            option
          );
        } catch (err) {
          res.status(422).send(err);
        }

        if (story) {
          res.send(story);
        } else {
          res.status(204).send(story);
        }
      }
    } else {
      res.send('Invalid story ID');
    }

    // Need to control user based story
  });
};
