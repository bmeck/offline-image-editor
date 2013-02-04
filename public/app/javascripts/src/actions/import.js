var canvasUtils = require('../common/canvas');
module.exports = function (e) {
   var files = document.getElementById('action-upload').files;
   var file = files && files[0];
   if (file) {
      var blob = file.slice();
      var dataURI = URL.createObjectURL(blob);
      var importedImage = new Image();
      importedImage.src = dataURI;
      importedImage.onload = function () {
         canvasUtils.fromImage(importedImage)
      }
      importedImage.onerror = function () {
         alert('Unable to load image ' + file.name);
      }
   }
}