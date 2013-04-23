/**
 * Provides wrapping of modules for use in the browser.
 **/
"use strict";

var fs = require('fs'), path = require('path'), extexp = /\.(\w+)$/;

function translate(name, uri, buffer, opts) {
	var ext = uri.match(extexp)[1];
	if (opts.translate[ext]) return opts.translate[ext](name, uri, buffer, opts);
	if ('js' === ext) return buffer.toString('utf8');
	if ('json' === ext) return 'module.exports = ' + buffer.toString('utf8');
	return 'module.exports = ' + JSON.stringify(buffer.toString('utf8')); // export file as json string
}

function getUri(id, opts, next) {
	var uri = opts.map[id] || id, f, ff = opts.forbid, forbid, forbidden;
	uri = path.resolve(opts.root, uri);
	// require, bundles.json, and mapped modules can be in forbidden places
	if ('bundles.json' !== id && 'require' !== id && !opts.map[id]) {
		if ('..' === path.relative(opts.root, uri).slice(0, 2)) {
			return next(new Error('Forbidden'), '');
		}
		for (f = 0; f < ff; ++f) {
			forbid = opts.forbid[f];
			forbidden = forbid.test ? forbid.test(uri) :
				(uri.slice(0, forbid.length) === forbid);
			if (forbidden) { return next(new Error('Forbidden'), ''); }
		}
	}
	fs.stat(uri, function(err, stats) {
		if (err) {
			return fs.exists(uri + '.js', function(exists) {
				return next(null, uri + (exists ? '.js' : ''));
			});
		}
		if (stats.isDirectory()) {
			return fs.exists(uri + '/index.js', function(exists) {
				return next(null, uri + (exists ? '/index.js' : ''));
			});
		}
		return next(null, uri);
	});
}

function getOptions(opts) {
	opts = opts || {};
	opts.root = opts.root || __dirname;
	opts.path = opts.path || '/module/';
	opts.maxAge = opts.maxAge || 0;
	opts.compress = opts.compress || false;
	opts.bundles = opts.bundles || false;
	opts.map = opts.map || {};
	opts.map.require = opts.map.require || __dirname + '/require';
	opts.translate = opts.translate || {};
	opts.forbid = (opts.forbid || []).map(function(p) {
		return path.resolve(opts.root, p);
	});
	return opts;
}

/**
 * Prints the code for the bundles, including all dependencies
 **/
function bundles(bundleMap, opts, next) {
	opts = getOptions(opts);
	var stack = Object.keys(bundleMap).reverse(), result = {}, map = {};

	function done() {
		for (var name in result) {
			var deps = {};
			result[name].dependencies.forEach(function(id) { deps[map[id] || id] = 1; });
			result[name].dependencies = Object.keys(deps);
		}
		next(null, result);
	}

	function loop() {
		if (!stack.length) return done();
		var name = stack.pop(),
			include = bundleMap[name].modules,
			exclude = bundleMap[name].dependencies || [];
		dependencies(exclude, opts, function(err, exclude) {
			if (err) { return next(err); }
			dependencies(include, opts, function(err, include) {
				if (err) { return next(err); }
				var depends = include.filter(function(id) { return ~exclude.indexOf(id); });
				include = include.filter(function(id) { return !~exclude.indexOf(id); });
				include.forEach(function(id) { map[id] = map[id] || (name + '.bundle'); });
				result[name] = { modules:include, dependencies:depends };
				loop();
			});
		});
	}
	loop();
}

/**
 * Prints the code for the module, including boilerplate code necessary in the browser.
 **/
function module(id, opts, next) {
	if (id.slice(-3) === '.js') id = id.slice(0, -3);
	opts = getOptions(opts);
	getUri(id, opts, function(err, uri) {
		fs.stat(uri, function(err, stat) {
			if (err) { return next(err); }
			fs.readFile(uri, function(err, buffer) {
				if (err) return next(err);
				var content = buffer.toString('utf8');
				if ('bundles.json' === id) { 
					bundles(JSON.parse(content), opts, function(err, content) {
						if (err) { return next(err); }
						content = 'define.bundle.map(' + JSON.stringify(content) + ');\n';
						next(null, content, stat.mtime);
					});
				} else {
					if ('require' !== id) {
						content = translate(id, uri, buffer, opts);
						content = 'define(' + JSON.stringify(id) +
							',function(require,exports,module){' + content + '\n});\n';
					}
					if (opts.compress) {
						opts.compress(content, function(err, content) {
							if (err) return next(err);
							next(null, content, stat.mtime);
						});
					} else {
						next(null, content, stat.mtime);
					}
				}
			});
		});
	});
}

/**
 * Prints the code for the modules, including boilerplate code necessary in the browser.
 **/
function modules(modules, opts, next) {
	var modified = new Date(0),
		length = modules.length, m = 0,
		out = '';

	opts = getOptions(opts);
	var compressfn = opts.compress;
	opts.compress = null; // don't compress each individually

	function loop() { // append each module
		if (m < length) return module(modules[m++], opts, append);
		if (!compressfn) return next(null, out, modified);
		compressfn(out, function(err, out) {
			if (err) return next(err);
			next(null, out, modified);
		});
	}

	function append(err, content, mod) {
		if (err) return next(err);
		out += content;
		if (mod > modified) modified = mod;
		loop();
	}

	if ('require' !== modules[0]) {
		out += // allow this package to be before require.js
			'if (!this.define) { this.define = (function() {\n' +
			'	function define(id, fn) { defs[id] = fn; }\n' +
			'	var defs = define.defs = {};\n' +
			'	return define;\n' +
			'}()); }\n\n';
	}
	loop();
}

/**
 * Finds all the module's nested dependencies and provides the ids as an array
 *  id can be a string or an array of absolute module id strings
 **/
function dependencies(id, opts, next) {
	opts = getOptions(opts);
	var stack = [].concat(id), list = [].concat(id),
		reqexp = /\brequire\s*\(\s*(['"]).+?\1\s*\)/g,
		idexp = /(['"])(.+?)\1/, ext = '.js';

	function resolve(id, base) {
		if (id.slice(-ext.length) === ext) { id = id.slice(0, -ext.length); }
		if (id.charAt(0) === '.') { id = base.replace(/[^\/]+$/, id); }
		var orig = id.split('/'), terms = [], i, l = orig.length;
		for (i = 0; i < l; ++i) {
			if (orig[i] === '..') { terms.pop(); }
			else if (orig[i] !== '.') { terms[terms.length] = orig[i]; }
		}
		return terms.join('/');
	}

	function loop() {
		if (!stack.length) return next(null, list);
		var id = stack.pop();
		getUri(id, opts, function(err, uri) {
			fs.readFile(uri, function(err, buffer) {
				if (err) {
					if ('ENOENT' === err.code) {
						list.splice(list.indexOf(id), 1);
						return loop();
					} else { return next(err); }
				}
				var content = translate(id, uri, buffer, opts);
				var matches = content.match(reqexp),
					m, mm = matches && matches.length;
				for (m = 0; m < mm; ++m) {
					var rid = resolve(matches[m].match(idexp)[2], id);
					if (!~list.indexOf(rid)) {
						list[list.length] = stack[stack.length] = rid;
					}
				}
				loop();
			});
		});
	}
	loop();
}

/**
 * Provides middleware to format module code for use in the browser.
 **/
function middleware(opts) {
	opts = getOptions(opts);
	var path = opts.path, deps = /\/dependencies\.json$/i;

	return function(req, res, next) {
		if (req.path.slice(0, path.length) !== path) return next();
		var id = req.path.slice(path.length);

		if (deps.test(id)) {
			dependencies(id.replace(deps, ''), opts, function(err, content) {
				if (err) return 'ENOENT' === err.code ? next() : next(err);
				res.set('Content-Type', 'application/json');
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
				res.send(content);
			});
		} else {
			module(id, opts, function(err, content, modified) {
				if (err) return 'ENOENT' === err.code ? next() : next(err);
				res.set('Content-Type', 'application/javascript');
				res.set('Last-Modified', modified.toGMTString());
				res.set('Cache-Control', 'public, max-age=' + opts.maxAge);
				res.send(content);
			});
		}
	};
}

exports.middleware = middleware;
exports.dependencies = dependencies;
exports.modules = modules;
exports.module = module;
exports.bundles = bundles;
exports.getOptions = getOptions;
