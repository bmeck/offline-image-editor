var stream = require('stream');
exports.pen = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   ctx.fillStyle = 'black';
   ctx.fillRect(e.clientX - c.offsetLeft - 5, e.clientY - c.offsetTop - 5, 10, 10);
}