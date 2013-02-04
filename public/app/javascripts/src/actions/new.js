var canvasUtils = require('../common/canvas');
module.exports = function (e) {
   openDialog('new-image-dialog', function (err, form) {
      if (err) {
         if (err != 'CANCEL') alert(err);
      }
      else {
         var width = document.getElementById('new-image-width').value;
         var height = document.getElementById('new-image-height').value;
         canvasUtils.newCanvas(width, height);
      }
   });
}