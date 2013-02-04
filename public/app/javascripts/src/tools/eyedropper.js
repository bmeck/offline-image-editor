module.exports = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   var rgba = ctx.getImageData(e.clientX - c.offsetLeft, e.clientY - c.offsetTop, 1, 1);
   var color = '#' + ([].slice.call(rgba.data).map(function (chan) {
      return chan < 16 ? '0' + chan.toString(16) : chan.toString(16);
   }).join('')).slice(0,-2);
   document.getElementById('setting-color').value = color
}