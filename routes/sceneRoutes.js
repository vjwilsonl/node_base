'use strict';
/**
 *
 * @sceneRoutes.js
 * Provide API endpoints for scenes
 */
var express = require('express');
var router = express.Router();
var passport = require('passport');
var mongoose = require('mongoose');
var keys = require('../config/keys');
// copying of files
var fs = require('fs');
var path = require('path');
// mongo db
var User = mongoose.model('users');
var Story = mongoose.model('stories');
var Scene = mongoose.model('scenes');
// check file type
var readChunk = require('read-chunk');
var fileType = require('file-type');
// custom helper functions
var {
  uploadSceneImageParams,
  deleteImageParams
} = require('../services/uploadFileParams');
var { errorResponse, successResponse } = require('../services/responseParams');
var CustomError = require('../services/CustomError');
var { validMongooseId } = require('../middlewares/mongooseValidator');
// configuring the AWS environment
var AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: keys.awsAccessKeyID,
  secretAccessKey: keys.awsSecretKey
});
var { check, validationResult } = require('express-validator');
// file upload library
var multer = require('multer');
var { uploadImage } = require('../services/uploadFile');

function isUserStory(story, req) {
  // var uid =
  //   typeof req.user !== 'undefined' ? req.user.id : '5c7f539b7c34db3024c6795b';
  // return story._user == uid;
  return story._user == req.user.id;
}
function isUserScene(scene, req) {
  // var uid =
  //   typeof req.user !== 'undefined' ? req.user.id : '5c7f539b7c34db3024c6795b';
  // return scene._user == uid;
  return scene._user == req.user.id;
}

/**
 * Validators
 */
var sceneValidator = [
  check('name')
    .not()
    .isEmpty()
    .withMessage('Name field is required')
    .trim()
    .escape(),
  check('backgroundColor')
    .not()
    .isEmpty()
    .withMessage('Background color field is required')
    .trim()
    .escape()
    .isHexColor()
    .withMessage('Background color have to be a valid hexadecimal color'),
  check('template')
    .not()
    .isEmpty()
    .withMessage('Template field is required')
    .isIn(['1', '2', '3', '4'])
    .withMessage('Template field value is not valid')
    .trim()
    .escape(),
  check('storyId')
    .not()
    .isEmpty()
    .withMessage('Invalid story')
    .trim()
    .escape()
];
var sceneUpdateValidator = [
  check('name')
    .not()
    .isEmpty()
    .withMessage('Name field is required')
    .trim()
    .escape(),
  check('backgroundColor')
    .not()
    .isEmpty()
    .withMessage('Background color field is required')
    .trim()
    .escape()
    .isHexColor()
    .withMessage('Background color have to be a valid hexadecimal color'),
  check('template')
    .not()
    .isEmpty()
    .withMessage('Template field is required')
    .isIn(['1', '2', '3', '4'])
    .withMessage('Template field value is not valid')
    .trim()
    .escape()
];
/**
 * API ROUTES
 */
/**
 * POST /api/scene
 * Create new scene
 */
router.post(
  '/',
  uploadImage.single('vrImage'),
  sceneValidator,
  async (req, res, next) => {
    // if express validator have error
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }
    var { name, backgroundColor, template, storyId } = req.body;
    // check if valid story ID
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      // Story ID passed in is not valid
      return res.status(422).send(errorResponse('Invalid story ID', 'id'));
    }
    // check if image file uploaded
    if (!req.file) {
      return res.send(errorResponse('Please upload an image.', 'vrImage'));
    }
    // check if story belong to user
    try {
      var story = await Story.findById(storyId);
      if (!story) {
        // no story found with the ID
        return res
          .status(404)
          .send(errorResponse('Unable to create scene, story not found'));
      } else if (!isUserStory(story, req)) {
        // story dont belong to user
        return res
          .status(403)
          .send(
            errorResponse(
              'Unable to create scene, this story does not belong to you'
            )
          );
      }
    } catch (err) {
      if (err) {
        const error = new Error(err);
        return next(error);
      }
    }

    var filePath = process.cwd() + '/' + req.file.path;
    var params = uploadSceneImageParams(filePath);
    // Upload vr image to s3
    var s3 = new AWS.S3();
    try {
      // TODO maybe try out direct upload to s3 instead of saving in local
      var s3file = await s3.upload(params).promise();
    } catch (err) {
      // TODO Loggin
      return res
        .status(422)
        .send(errorResponse('Unable to upload file', 'vrImage', 'body'));
    }
    // remove local file
    fs.unlinkSync(filePath);
    // Get current user ID (TODO remove the default uid)
    // var uid =
    //   typeof req.user !== 'undefined'
    //     ? req.user.id
    //     : '5c7f539b7c34db3024c6795b';
    var uid = req.user.id;
    // Create new scene
    try {
      var scene = await new Scene({
        name,
        backgroundColor,
        vrImage: {
          url: s3file.Location,
          key: s3file.key
        },
        template,
        _story: storyId,
        _user: uid
      });
      var saveScene = await scene.save();
      // Respond with newest copy of scene created
      return res.send(successResponse(saveScene, 'Scene successfully created'));
      // HERE
    } catch (err) {
      if (err) {
        const error = new Error(err);
        return next(error);
      }
    }
  }
);
/**
 * POST /api/scene/:id
 * UPDATE scene details
 */
router.post(
  '/:id',
  uploadImage.single('vrImage'),
  sceneUpdateValidator,
  async (req, res, next) => {
    // if express validator have error
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }
    // check for valid mongoose object id for scene
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(422).send(errorResponse('Invalid scene ID', 'id'));
    }
    // check if scene belong to user
    try {
      var originalScene = await Scene.findById(req.params.id);
      if (!originalScene) {
        // scene not found
        return res
          .status(404)
          .send(errorResponse('Unable to update, scene not found'));
      } else if (!isUserScene(originalScene, req)) {
        // scene dont belong to user
        return res
          .status(403)
          .send(
            errorResponse('Unable to update, this scene does not belong to you')
          );
      }
    } catch (err) {
      if (err) {
        const error = new Error(err);
        return next(error);
      }
    }
    // get body parameters
    var { name, backgroundColor, template } = req.body;
    var update = { name, backgroundColor, template };
    var option = { new: true };
    // check if new file uploaded
    if (req.file) {
      var filePath = process.cwd() + '/' + req.file.path;
      var params = uploadSceneImageParams(filePath);
      var s3 = new AWS.S3();
      // begin upload
      try {
        // TODO maybe try out direct upload to s3 instead of saving in local
        var s3file = await s3.upload(params).promise();
      } catch (err) {
        // TODO Logging
        return res
          .status(422)
          .send(errorResponse('Unable to upload file', 'vrImage'));
      }
      update.vrImage = {};
      update.vrImage.url = s3file.Location;
      update.vrImage.key = s3file.key;
      // remove local file
      fs.unlinkSync(filePath);
      // delete old s3 image if new one uploaded
      // TODO send to queue
      if (originalScene.vrImage.key) {
        var oldSceneParams = deleteImageParams(originalScene.vrImage.key);
        s3.deleteObject(oldSceneParams, (err, data) => {
          if (err) {
            // TODO log error
            console.error(err);
          } else {
            // TODO log deleted file
            console.log(
              'CONSOLE LOG: user: ' +
                req.body.id +
                ' deleted s3 image with key: ' +
                originalScene.vrImage.key
            );
          }
        });
      }
    }
    // update new datas
    try {
      var updatedScene = await Scene.findByIdAndUpdate(
        req.params.id,
        update,
        option
      );
    } catch (err) {
      return res.status(422).send(err);
    }
    return res.send(
      successResponse(updatedScene, 'Scene successfully updated')
    );
  }
);
router.get('/:id', validMongooseId, async (req, res) => {
  try {
    var scene = await Scene.findById(req.params.id).lean();
  } catch (err) {
    return res.status(422).send(err);
  }
  // no scene found
  if (!scene) {
    return res.status(404).send(errorResponse('No scene found'));
  }
  // find story
  try {
    var story = await Story.findById(scene._story);
  } catch (err) {
    return res.status(422).send(err);
  }
  // something went wrong, scene not linked to an existing story
  if (!story) {
    return res.status(404).send(errorResponse('No associated story found'));
  }
  // check if story belongs to user or is public
  if (!isUserStory(story, req) && story.visibility != 'public') {
    // story do not belong to user and not public
    return res
      .status(403)
      .send(errorResponse('You do not have permission to view this scene'));
  }
  return res.send(successResponse(scene, 'Successfully retrieve scene detail'));
});

router.get('/test', uploadImage.none(), async (req, res, next) => {
  try {
    var originalStory = await Story.findById('5d664447f8b67e20a94a885d');
    console.log(originalStory);
    return;
    if (originalStory && !isUserStory(originalStory, req)) {
      return res
        .status(403)
        .send(
          errorResponse('Unable to update, this story does not belong to you')
        );
    } else {
    }
  } catch (err) {
    if (err) {
      const error = new Error(err);
      return next(error);
    }
  }
});

module.exports = router;
