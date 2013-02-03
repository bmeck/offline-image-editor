var FSFactory = require('./browserify-fs').FSFactory;
var path = require('path')
exports.createImageImplementation = function (dir, cb) {
   //
   // 25mb?
   //
   FSFactory(1024 * 1024 * 25, 'images', function(err, fs) {
      if (err) {
         cb(err, null);
         return;
      }
      function Image(id) {
         this.file = path.join(dir, id);
         return this;
      }
      Image.prototype.read = function (cb) {
         fs.readFileAsBlob(this.file, cb);
      }
      Image.prototype.write = function (data, cb) {
         fs.writeFile(this.file, data, cb);
      }
      Image.prototype.remove = function (cb) {
         fs.unlink(this.id, cb);
      }
      Image.list = function (cb) {
         fs.readdir(dir, function (err, files) {
            if (err && err.code === err.NOT_FOUND_ERR) {
               files = [];
            }
            cb(null, [].slice.call(files).map(function (file) {
               return file.name;
            }));
         });
      }
      fs.mkdir(dir, function (err) {
         if (err) {
            cb(err, null);
            return;
         }
         cb(null, Image);
      });
    });
}