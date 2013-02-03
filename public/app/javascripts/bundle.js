(function(){
var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/fs-image.js",function(require,module,exports,__dirname,__filename,process,global){var FSFactory = require('./browserify-fs').FSFactory;
var path = require('path')
exports.createImageImplementation = function (dir, cb) {
   //
   // 25mb?
   //
   FSFactory(1024 * 1024 * 25, 'images', function(err, fs) {
      if (err) {
         cb(err, null);
         return;
      }
      function Image(id) {
         this.file = path.join(dir, id);
         return this;
      }
      Image.prototype.read = function (cb) {
         fs.readFileAsBlob(this.file, cb);
      }
      Image.prototype.write = function (data, cb) {
         fs.writeFile(this.file, data, cb);
      }
      Image.prototype.remove = function (cb) {
         fs.unlink(this.id, cb);
      }
      Image.list = function (cb) {
         fs.readdir(dir, function (err, files) {
            if (err && err.code === err.NOT_FOUND_ERR) {
               files = [];
            }
            cb(null, [].slice.call(files).map(function (file) {
               return file.name;
            }));
         });
      }
      fs.mkdir(dir, function (err) {
         if (err) {
            cb(err, null);
            return;
         }
         cb(null, Image);
      });
    });
}
});

require.define("/browserify-fs.js",function(require,module,exports,__dirname,__filename,process,global){/**
  fs.js (c) OptimalBits 2012.
  
  A lightweight wrapper for the File System API inspired in nodejs fs module.
  
  authors: manuel@optimalbits.com
           linus@optimalbits.com
           
  Licensed as MIT.
   
*/
(function() {
  
  window.StorageInfo = window.StorageInfo || window.webkitStorageInfo;
  window.RequestFileSystem = window.RequestFileSystem || window.webkitRequestFileSystem;

  var FSFactory = function (size, folder, cb) {
    folder = folder || 'fs_folder';
    window.StorageInfo.requestQuota(PERSISTENT, size, function (grantedBytes) {
      window.RequestFileSystem(PERSISTENT, grantedBytes, function (fs) {
        fs.root.getDirectory(folder, {create:true}, function (entry) {
          cb(null, new FS(fs, entry, grantedBytes));
        }, cb);
      }, cb);
    }, cb);
  };

  /**
    The wrapper object.
  */
  var FS = function (fs, root, grantedBytes) {
    this.fs = fs;
    this.root = root;
    this._availableBytes = this._grantedBytes = grantedBytes;
  }
  
  FS.prototype = {
  
    /**
      rename(oldPath, newPath, callback)
    
      Renames a file or directory.
    */
    rename : function(path, newPath, cb){
      var self = this, root = self.root;
      traverse(root, path, function(err, entry){
        if(entry){
          traverse(root, dirname(newPath), function(err, dstDir){
            if(dstDir){
              entry.moveTo(dstDir, basename(newPath), function(){
                cb();
              }, cb);
            }else{
              cb(err);
            }
          });
        }else{
          cb(err);
        }
      });
    },
    
    truncate : function(path, length, cb){
      // IMPLEMENT using FileWriter truncate.
    },
    
    /**
      stat(path, callback)
      
      Calls the callback with stats object with the following data:
      
      isFile, isDirectory, size, mtime (modification time).
    */
    stats : function(path, cb){
      traverse(this.root, path, function(err, entry){
        if(entry){
          entry.getMetadata(function(meta){
            meta.isFile = function(){return entry.isFile};
            meta.isDirectory = function(){return entry.isDirectory};
            cb(null, meta);
          }, cb)
        }else{
          cb(err);
        }
      });
    },
    
    /** 
      Checks if a file exists or not.
      
      Test whether or not the given path exists by checking with the file system. 
      Then call the callback argument with either true or false
    */
    exists : function(path, cb){
      traverse(this.root, path, function(err){
        cb(err ? false : true);
      });
    },
    
    /**
      unlink(filename, callback)
      remove(filename, callback)
      
      Removes the given file from the filesystem.
    */
    unlink : function (filename, cb) {
      var self = this;
      self.root.getFile(filename, {}, function (fileEntry) {
        fileEntry.remove(function () {
          self._availableBytes += fileEntry.size;
          cb(null, true)
        }, cb)
      }, cb)
    },
    
    /**
      Removes a directory and all its contents.
      (to use if removeRecursively not available, or when wanting to delete
      the root of all filesystems).
    */
    rmdir : function(dirname, cb){
      var root = this.root;
      if(dirname == '/'){
        this.readdir('/', function(err, entries){
          if(!err){
            parallel(entries, function(entry, cb){
              entry.removeRecursively(cb, cb);
            }, cb);
          }else{
            cb(err);
          }
        });
      }else{
        traverse(root, dirname, function(err, entry){
          if(err || !entry.isDirectory){
            cb(err || new Error('Path is not a directory'));  
          }else{
            entry.removeRecursively(cb,cb);
          }
        });
      }
    },
        
    /**
      Creates a directory in the given path. 
      cb(err, entry)
      (Note that it will return error if the subpath does not exist).
    */
    mkdir : function(dirpath, cb){
      var self = this;
      traverse(this.root, dirname(dirpath), function(err, entry){
        if(err || !entry.isDirectory){
          cb(err || new Error('Path is not a directory'));
        }else{
          self._mkdir(entry, basename(dirpath), cb);
        }
      });
    },
    
    _mkdir : function(root, dir, cb){
      root.getDirectory(dir, {create:true}, function(entry){
        cb(null, entry);
      }, cb);
    },
    
    /**
      As mkdir but also creates all the folders in the dirpath if 
      needed.
      cb(err, entry).
    */
    mkpath : function(dirpath, cb){
      var components = dirpath.split('/');
      this._mkpath(this.root, components, cb);
    },
      
    _mkpath : function(root, components, cb){
      var self = this;
      if (components[0] == '.' || components[0] == '') {
        components = components.slice(1);
      }
      self._mkdir(root, components[0], function(err, entry){
        if(entry && components.length){
          self._mkpath(entry, components.slice(1), cb);
        }else{
          cb(err, entry);
        }
      });
    },
    
    /**
      Reads the content of a directory at the given path.
      cb(err, entries {Array of DirectoryEntry:s})
    */
    readdir : function(path, cb){
      traverse(this.root, path, function(err, entry){
        if(err || !entry.isDirectory){
          cb(err || new Error('Path is not a directory'));
        }else{
          var reader = entry.createReader();
          reader.readEntries(function(entries){
            cb(null, entries);
          }, cb);
        }
      });    
    },
    
    /**
      Changes the timestamps of a file or directory at the 
      given path.
    */
    utimes : function(path, atime, mtime, cb){
      // TO IMPLEMENT;
    },
      
    readFile : function(filename, encoding, cb){
      this.read.apply(this, arguments);
    },
    
    readFileAsBlob : function (filename, cb) {
      traverse(this.root, filename, function (err, entry) {
        if(entry){
          entry.file(function (blob) {
            cb(null, blob);
          }, cb);
        }else{
          cb(err);
        }
      });
    },
    
    readFileAsUrl : function (filename, cb) {
      traverse(this.root, filename, function (err, entry) {
        if(entry){
          cb(null, entry.toURL());
        }else{
          cb(err);
        }
      });
    },
    
    writeFile : function(filename, data, cb){
      this.write(filename, new Blob([data]), cb);
    },
    
    appendFile : function(filename, data, cb){
      this.append(filename, new Blob([data]), cb);
    },
    
    /**
      Wipes the whole file system. 
      
      wipe(cb, [full])
      
      Use full = true if you want to wipe the root dir of the filesystem,
      after doing this, the instance cannot be used anymore.
    */
    wipe : function (cb, full) {
      var self = this, folder = self.root.fullPath;
      self.root.removeRecursively(function(){
        if(!full){
          self.fs.root.getDirectory(folder, {create:true}, function (root) {
            self.root = root;
            self._availableBytes = self._grantedBytes;
            cb();
          }, cb);
        }else{
          cb();
        }
      }, cb);
    } 
  }
  
  FS.prototype.remove = FS.prototype.unlink;

  //File.prototype.getAvailableBytes = function(cb) {
  //  cb(null, this._available_bytes);
  //}
  FS.prototype.read = function (filename, encoding, cb) {
    if(arguments.length==2){
      cb = encoding;
      encoding = undefined;
    }
    traverse(this.root, filename, function (err, entry) {
      if(entry){
        entry.file(function (file) {
          var reader = new FileReader();
          reader.onloadend = function (e) {
            cb(null, this.result);
          };
          if(encoding){
            reader.readAsText(file, encoding);
          }else{
            reader.readAsArrayBuffer(file);
          }
        }, cb);
      }else{
        cb(err);
      }
    });
  };
    
  /**
     Writes a blob to a file, and returns fileEntry if succesful.
  */
  FS.prototype.write = function (filename, blob, cb) {
    var self = this;
    self.root.getFile(filename, {create: true, exclusive: true}, function (entry) {
      self.append(filename, blob, cb);
    }, function(err){
      self.remove(filename, function(){
        self.write(filename, blob, cb);
      }, cb);
    });
  };

  FS.prototype.append = function (filename, blob, cb) {
    var self = this;
    this.root.getFile(filename, {create:true}, function (fileEntry) {
      fileEntry.createWriter(function (fileWriter) {
        fileWriter.onwriteend = function (e) {
          self._availableBytes -= fileEntry.size;
          cb(null, fileEntry);
        };
        fileWriter.seek(fileWriter.length);
        fileWriter.onerror = cb;
        fileWriter.write(blob);
      }, cb);
    }, cb);
  };

  FS.prototype.validateFileSize = function(filename, size, cb) {
    traverse(this.root, filename, function (fileEntry) {
      fileEntry.createWriter(function(fileWriter) {
        if (fileWriter.length == size) {
          cb(null, true);
        } else {
          cb(new Error('Wrong filesize'));
        }
      }, cb);
    }, cb);
  };
  
  FS.prototype.errorHandler = function (e) {
    var msg = '';

    switch (e.code) {
      case FileError.QUOTA_EXCEEDED_ERR:
        msg = 'QUOTA_EXCEEDED_ERR';
        break;
      case FileError.NOT_FOUND_ERR:
        msg = 'NOT_FOUND_ERR';
        break;
      case FileError.SECURITY_ERR:
        msg = 'SECURITY_ERR';
        break;
      case FileError.INVALID_MODIFICATION_ERR:
        msg = 'INVALID_MODIFICATION_ERR';
        break;
      case FileError.INVALID_STATE_ERR:
        msg = 'INVALID_STATE_ERR';
        break;
      default:
        msg = 'Unknown Error';
        break;
    }

    console.log('File System Error: ' + msg);
  };
  
  /**
     Traverse the file system and returns a FileEntry 
     or a DirectoryEntry (or error if path does not exist).
  */
  function traverse(root, path, cb){    
    function visit(entry, components, index, cb){
      if(index === components.length){
        cb(null, entry);
      }else{
        if(entry.isDirectory){
          entry.getDirectory(components[index], {}, function(entry){
            visit(entry, components, index+1, cb);
          }, function(err){
            if(err && err.code == err.TYPE_MISMATCH_ERR){
              entry.getFile(components[index], {}, function(entry){
                visit(entry, components, index+1, cb);
              }, cb);
            }else{
              cb(err);
            }
          });
        }else{
          cb(new Error(entry.fullPath+' not a valid directory'));
        }
      }
    }
    
    if(path == '/' && path == ''){
      cb(null, root);
    }else{
      visit(root, path.split('/'), 0, cb);
    }
  }
  
  function dirname(path){
    var s = path.split('/'); 
    s.pop();
    return s.join('/');
  }
  
  function basename(path){
    return path.split('/').pop();
  }
  
  function parallel(entries, fn, cb){
    var counter = 0, length = entries.length, error;
    for(var i=0; i < length; i++){
      fn(entries[i], function(err){
        error = error || err;
        counter++;
        if(counter==length){
          cb(error);
        }
      });
    }
  }
  
  // AMD define happens at the end for compatibility with AMD loaders
  // that don't enforce next-turn semantics on modules.
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return FSFactory;
    });
  }else{
    this.FSFactory = FSFactory;
  }
  
}).call(typeof exports == 'object' ? exports : this);

});

require.define("/events.js",function(require,module,exports,__dirname,__filename,process,global){function clearCanvas() {
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
function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    return new Blob([ab], {type:mimeString});
}
module.exports = {
   'action-new': {
      'click': function (e) {
         openDialog('new-image-dialog', function (err, form) {
            if (err) {
               if (err != 'CANCEL') alert(err);
            }
            else {
               var width = document.getElementById('new-image-width').value;
               var height = document.getElementById('new-image-height').value;
               newCanvas(width, height);
            }
         });
      }
   },
   'action-gallery': {
      'click': function (e) {
         var nav = document.getElementById('gallery-nav');
         while(nav.childNodes.length) nav.removeChild(nav.firstChild);
         img.list(function (err, files) {
            if (!files || !files.length) {
               alert('You need to save some files first!');
               return;
            }
            files.forEach(function (file) {
               var radio = document.createElement('input');
               radio.name = 'gallery-choice';
               radio.type = 'radio';
               radio.value = file;
               var thumb = document.createElement('img');
               thumb.src = 'pictures/'+file;
               thumb.onclick = radio.click.bind(radio);
               nav.appendChild(radio);
               nav.appendChild(thumb);
            });
            openDialog('gallery-dialog', function (data, form) {
               new img(form.querySelector('input:checked').value).read(function (err, data) {
                  var image = new Image();
                  image.onload = function () {
                     newCanvas(image.naturalWidth, image.naturalHeight);
                     var c = document.getElementById('c');
                     c.getContext('2d').drawImage(image, 0, 0);
                  }
                  image.onerror = function () {}
                  var filereader = new FileReader();
                  filereader.readAsDataURL(data);
                  filereader.onload = function () {
                     image.src = filereader.result.replace(/^data:;/,'data:image/png;');
                  }
               });
            })
         });
      }
   },
   'action-save': {
      'click': function (e) {
         var datauri = document.getElementById('c').toDataURL('image/png;base64')
         var blob = dataURItoBlob(datauri);
         openDialog('save-dialog', function (data, form) {
            new img(form.querySelector('input[type=text]').value).write(blob, function (err) {
               console.log(arguments);
            });
         });
      }
   },
   'action-upload': {
      'change': function (e) {
         var files = document.getElementById('action-upload').files;
         var file = files && files[0];
         if (file) {
            var blob = file.slice();
            var dataURI = webkitURL.createObjectURL(blob);
            var img = new Image();
            img.src = dataURI;
            img.onload = function () {
               newCanvas(img.naturalWidth, img.naturalHeight);
               var c = document.getElementById('c');
               var ctx = c.getContext('2d');
               ctx.drawImage(img, 0, 0)
            }
            img.onerror = function () {
               alert('Unable to load image ' + file.name);
            }
         }
      }
   },
   'action-download': {
      'click': function (e) {
         window.open(document.getElementById('c').toDataURL());
      }
   }
};
});

require.define("/editor-tools.js",function(require,module,exports,__dirname,__filename,process,global){var stream = require('stream');
exports.pen = function (e) {
   var c = e.target;
   var ctx = c.getContext('2d');
   ctx.fillStyle = 'black';
   ctx.fillRect(e.clientX - c.offsetLeft - 5, e.clientY - c.offsetTop - 5, 10, 10);
}
});

require.define("stream",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("util",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');

exports.isArray = isArray;
exports.isDate = function(obj){return Object.prototype.toString.call(obj) === '[object Date]'};
exports.isRegExp = function(obj){return Object.prototype.toString.call(obj) === '[object RegExp]'};


exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(exports.inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      default:
        return x;
    }
  });
  for(var x = args[i]; i < len; x = args[++i]){
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + exports.inspect(x);
    }
  }
  return str;
};

});

require.define("/main.js",function(require,module,exports,__dirname,__filename,process,global){require('./fs-image').createImageImplementation('pictures', function (err, imageImplementation) {
   var Image = window.img = imageImplementation;
});

//
// Hook up the events
//
var eventsByIdAndName = require('./events');
Object.keys(eventsByIdAndName).forEach(function (id) {
   var elem = document.getElementById(id);
   if (elem) Object.keys(eventsByIdAndName[id]).forEach(function (event) {
      elem.addEventListener(event, eventsByIdAndName[id][event]);
   });
});

//
// Keep up to date with online status. (do not rely on this)
//
function setOnlineStatus(isOnline) {
   document.body.classList.add(isOnline ? 'online' : 'offline');
   document.body.classList.remove(isOnline ? 'offline' : 'online');
}
setOnlineStatus(navigator.onLine);
window.addEventListener('online', setOnlineStatus);
window.addEventListener('offline', setOnlineStatus);

;(function () {
   var currentDialog;
   var currentCallback;
   window.openDialog = function openDialog(id, callback) {
      var dialog = document.getElementById(id);
      if (!dialog) {
         callback(new Error('Dialog not found'));
         return;
      }
      currentDialog = dialog;
      [].slice.call(document.querySelectorAll('#dialog-justify>[aria-active]')).forEach(function (activeDialog) {
         activeDialog.removeAttribute('aria-active');
      });
      document.getElementById('dialog-area').setAttribute('aria-active', 'true');
      dialog.setAttribute('aria-active', 'true');
      if (typeof callback === 'function') currentCallback = callback;
   }
   window.closeDialog = function closeDialog(err) {
      document.getElementById('dialog-area').removeAttribute('aria-active');
      if (currentCallback) {
         var callback = currentCallback;
         var form = currentDialog;
         currentCallback = currentDialog = null;
         callback(err, form);
      }
   }
})();

function fireTool(e) {
   var elem = document.querySelector('#editor-tools > input:checked');
   if (elem) {
      require('./editor-tools')[elem.value](e);
   }
}

;(function () {
   var dragging;
   var dragTimeout;
   var canvas = document.getElementById('c');
   canvas.addEventListener('mousedown', function (e) {
      dragging = true;
      fireTool(e);
   });
   canvas.addEventListener('mouseup', function (e) {
      dragging = false;
      if (dragTimeout) clearTimeout(dragTimeout);
   });
   canvas.addEventListener('mousemove', function (e) {
      if (dragging) {
         fireTool(e);
      }
   });
   canvas.addEventListener('mouseout', function (e) {
      dragTimeout = setTimeout(function () {
         dragging = false;
      }, 5e2);
   });
   canvas.addEventListener('mouseover', function (e) {
      if (dragTimeout) clearTimeout(dragTimeout);
   });
})();

});
require("/main.js");

})();
