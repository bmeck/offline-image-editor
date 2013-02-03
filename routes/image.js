module.exports = function (app) {
  app.get('/app/pictures', function (req, res) {
    app.resources.Image.list(function (err, list) {
      if (err) {
         res.writeHead(err.code || 500, err.message);
         res.send(err);
         return;
      }
      res.send(list);
    });
  });
  app.get('/app/pictures/:id', function(req, res){
    new app.resources.Image(req.params.id).readStream(function (err, stream) {
      if (err) {
         res.writeHead(err.code || 500, err.message);
         res.send(err);
         return;
      }
      res.writeHeader('content-type', 'application/octet-stream');
      stream.pipe(res);
    });
  });
  app.put('/app/pictures/:id', function(req, res){
    new app.resources.Image(req.params.id).writeStream(function (err, stream) {
      if (err) {
         res.writeHead(err.code || 500, err.message);
         res.send(err);
         return;
      }
      req.pipe(stream);
      stream.on('error', function () {
         
      });
      stream.on('end', function () {
         
      });
    });
  });
  app.del('/app/pictures/:id', function(req, res){
    new app.resources.Image(req.params.id).remove(function (err) {
      if (err) {
         res.writeHead(err.code || 500, err.message);
         res.send(err);
         return;
      }
    });
    res.writeHead(msg);
  });
};