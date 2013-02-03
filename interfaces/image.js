function Image() {
   return this;
}
Image.prototype.readStream = function (meta, cb) {
   throw new Error('Not Implemented');
}
Image.prototype.writeStream = function (meta, cb) {
   throw new Error('Not Implemented');
}
exports.Image = Image;
