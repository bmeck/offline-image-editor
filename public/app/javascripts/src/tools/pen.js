module.exports = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   ctx.fillStyle = document.getElementById('setting-color').value;
   ctx.fillRect(e.clientX - c.offsetLeft - 5, e.clientY - c.offsetTop - 5, 10, 10);
}