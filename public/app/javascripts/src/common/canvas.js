exports.clearCanvas = clearCanvas;
exports.newCanvas = newCanvas;
exports.fromImage = fromImage;
function clearCanvas() {
   var c = document.getElementById('c');
   var ctx = c.getContext('2d');
   var fill = ctx.fillStyle;
   ctx.fillStyle='rgba(0,0,0,0)';
   ctx.fillRect(0,0,c.width,c.height);
   ctx.fillStyle=fill;
}
function newCanvas(width, height) {
   var c = document.getElementById('c');
   c.width = Math.abs(!width || isNaN(width) ? c.width : width);
   c.height = Math.abs(!height || isNaN(height) ? c.height : height);
   c.style.width = width + 'px';
   c.style.height = height + 'px';
   clearCanvas();
}
function fromImage(image) {
   newCanvas(image.naturalWidth, image.naturalHeight);
   var c = document.getElementById('c');
   c.getContext('2d').drawImage(image, 0, 0)
}