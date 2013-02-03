var fs = require('fs');
var path = require('path')
exports.createImageImplementation = function (dir) {
   function Image(id) {
      this.file = path.join(dir, id);
      return this;
   }
   Image.prototype.readStream = function (cb) {
      try {
         fs.statSync(this.file);
         cb(null, fs.createReadStream(this.file));
      }
      catch (e) {
         cb(e, null);
      }
   }
   Image.prototype.writeStream = function (cb) {
      try {
         cb(null, fs.createWriteStream(this.file));
      }
      catch (e) {
         cb(e, null);
      }
   }
   Image.prototype.remove = function (cb) {
      try {
         fs.unlink(this.id);
      }
      catch (e) {
         cb(e, null);
      }
   }
   Image.list = function (cb) {
      fs.readdir(dir, cb);
   }
   return Image;
}