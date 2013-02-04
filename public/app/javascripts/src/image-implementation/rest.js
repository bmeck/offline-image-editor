var path = require('path');
exports.createImageImplementation = function (pathname) {
   function Image(id) {
      this.pathname = path.join(pathname, id);
      return this;
   }
   Image.prototype.read = function (cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', this.pathname, true);
      xhr.responseType='arraybuffer';
      xhr.onreadystatechange = function () {
         if (xhr.readyState == 4) {
            xhr.status == 200 ? cb(null, xhr.response) : cb(new Error('Unable to delete image'));
         }
      }
      xhr.send();
   }
   Image.prototype.write = function (data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', this.pathname, true);
      xhr.onreadystatechange = function () {
         if (xhr.readyState == 4) {
            xhr.status == 200 ? cb(null) : cb(new Error('Unable to write image'));
         }
      }
      xhr.send(data);
   }
   Image.prototype.remove = function (cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('DELETE', this.pathname, true);
      xhr.onreadystatechange = function () {
         if (xhr.readyState == 4) {
            xhr.status == 200 ? cb(null) : cb(new Error('Unable to delete image'));
         }
      }
      xhr.send();
   }
   Image.list = function (cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', pathname, true);
      xhr.onreadystatechange = function () {
         console.log(xhr, xhr.readyState, xhr.response)
         if (xhr.readyState == 4) {
            xhr.status == 200 ? cb(null, JSON.parse(xhr.responseText)/*.map(function(x) {return path.join(pathname,x)})*/) : cb(new Error('Unable to load image list', null));
         }
      }
      xhr.send();
   }
   return Image;
}