exports.createNewImage = function () {
   ;
}
exports.uploadImage = function () {
   ;
}
exports.downloadImage = function () {
   ;
}
exports.showGallery = function () {
   openDialog('galler-dialog',function (err, form) {
      var img = form.elements.img.value;
   });
}