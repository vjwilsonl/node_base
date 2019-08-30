/**
 *
 * @uploadFileParams.js
 * Helper functions to return file upload params
 *
 */
const fs = require('fs');
const path = require('path');
// check file type
const readChunk = require('read-chunk');
const fileType = require('file-type');
// params for s3 bucket
const s3bucket = 'tusi360';

module.exports = {
  /**
   * Helper function to prepare thumbnail file upload for Story
   */
  uploadStoryImageParams: filePath => {
    const buffer = readChunk.sync(filePath, 0, fileType.minimumBytes);
    var fileMeta = fileType(buffer);
    /**
     * configuring file parameters
     */
    var params = {
      Bucket: s3bucket,
      Body: fs.createReadStream(filePath),
      Key: 'storyimage/' + Date.now() + '_' + path.basename(filePath),
      ACL: 'public-read',
      ContentType: fileMeta.mime
    };
    return params;
  },
  /**
   * Helper function to prepare image file upload for scene
   */
  uploadSceneImageParams: filePath => {
    const buffer = readChunk.sync(filePath, 0, fileType.minimumBytes);
    var fileMeta = fileType(buffer);
    /**
     * configuring file parameters
     */
    var params = {
      Bucket: s3bucket,
      Body: fs.createReadStream(filePath),
      Key: 'sceneimage/' + Date.now() + '_' + path.basename(filePath),
      ACL: 'public-read',
      ContentType: fileMeta.mime
    };
    return params;
  },
  /**
   * Helper function to delete file on S3 Bucket
   */
  deleteImageParams: Key => {
    var params = {
      Bucket: s3bucket,
      Key
    };
    return params;
  }
};
