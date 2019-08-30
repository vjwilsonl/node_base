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
const Scene = mongoose.model('scenes');
//check file type
const readChunk = require('read-chunk');
const fileType = require('file-type');

const { uploadStoryImage } = require('../services/uploadFileParams');

const AWS = require('aws-sdk');
//configuring the AWS environment
AWS.config.update({
  accessKeyId: keys.awsAccessKeyID,
  secretAccessKey: keys.awsSecretKey
});
const { check, validationResult } = require('express-validator');

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
const upload = multer({
  storage: storage,
  fileFilter: (req, file, callback) => {
    var ext = file.mimetype;
    if (ext != 'image/png' && ext != 'image/jpg' && ext != 'image/jpeg') {
      return callback(
        new Error('Invalid image file. Please upload png|jpg|jpeg only.')
      );
      // return callback('Image must be png/jpg/jpeg', false);
    }
    callback(null, true);
  }
});

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
}

function errorResponse(msg, params, location = 'body') {
  return {
    errors: [{ msg: msg, param: params, location: location }]
  };
}

/**
 * API ROUTES
 */
module.exports = app => {
  /**
   * POST /api/story
   * Create new story
   */
  app.post(
    '/api/story',
    upload.single('thumbnail'),
    [],
    async (req, res, next) => {
      const { title, description } = req.body;

      if (req.file) {
        const filePath = process.cwd() + '/' + req.file.path;
        const params = uploadStoryImage(filePath);
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
            try {
              var story = await new Story({
                title,
                description,
                imageUrl: data.Location,
                _user: uid
              });
              var saveStory = await story.save();
              //respond with newest copy of story created
              res.send(story);
            } catch (err) {
              if (err) {
                const error = new Error(err);
                next(error);
              }
            }
          }
        });
      } else {
        //no file uploaded
        res.send(
          errorResponse('Please upload a thumbnail image.', 'thumbnail')
        );
      }
    }
  );

  app.post(
    '/api/test1',
    upload.single('vrfile'),
    [
      //username must be an email
      check('username', 'Username is required.')
        .not()
        .isEmpty()
        .isEmail()
        .withMessage('Username must be an email.'),
      //description cannot be empty
      check('description')
        .not()
        .isEmpty(),
      check('vrfile', 'Please upload an image.')
        .not()
        .isEmpty()
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).send({ errors: errors.array() });
      }
      res.send('ok');
    }
  );

  app.post(
    '/api/test',
    upload.single('vrfile'),
    [
      //username must be an email
      (check('username', 'Username is required')
        .not()
        .isEmpty()
        .isEmail()
        .withMessage('Username must be an email'),
      //description cannot be empty
      check('description')
        .not()
        .isEmpty())
    ],
    (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).send({ errors: errors.array() });
      }
      res.send('hahaha');
      // manually handle file upload errors
      // uploadSingle(req, res, err => {
      //   if (err instanceof multer.MulterError) {
      //     res
      //       .status(400)
      //       .send({ error: 'A uknown error occurred when uploading.' });
      //   } else if (err) {
      //     res.status(422).send(errorResponse(err, 'vrfile', 'body'));
      //   } else {
      //     // if file is empty return error
      //     if (!req.file)
      //       res
      //         .status(422)
      //         .send(errorResponse('Please upload an image', 'vrfile', 'body'));
      //     // if express validator have error
      //     const errors = validationResult(req);
      //     if (!errors.isEmpty()) {
      //       res.status(422).send({ errors: errors.array() });
      //     }
      //     console.log(req.file);
      //   }
      // });
    }
  );

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
            //temp fixiya
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

  /**
   * POST /api/scene
   * Create scene
   */
  app.post(
    '/api/scene',
    [
      check('background_color')
        .not()
        .isEmpty()
        .withMessage('Background color is required')
        .isHexColor()
        .withMessage('Background color must be a validhexadecimal number')
    ],
    (req, res) => {
      console.log(req.body);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).send({ errors: errors.array() });
      }
      res.send('test');
      // manually handle file upload errors
      uploadSingle(req, res, err => {
        if (err instanceof multer.MulterError) {
          res
            .status(400)
            .send({ error: 'A uknown error occurred when uploading.' });
        } else if (err) {
          res.status(422).send(errorResponse(err, 'vrfile', 'body'));
        } else {
          // if file is empty return error
          if (!req.file)
            res
              .status(422)
              .send(errorResponse('Please upload an image', 'vrfile', 'body'));
          // if express validator have error
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            res.status(422).send({ errors: errors.array() });
          }
        }
      });
    }
  );
};
