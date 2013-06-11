# modules [![Build Status](https://secure.travis-ci.org/thetalecrafter/modules.png?branch=rewrite)](http://travis-ci.org/thetalecrafter/modules)

> Use CommonJS modules client-side in web applications

## Getting started

Install via npm

	npm install modules --save-dev

Add the middleware to your express or connect app

	app.get('/module/*', require('modules').middleware({
		root: './component', // where modules live in the filesystem
		path: '/module/' // the base path for modules in the browser
		// ... other options
	});

Add the client script to your html


	<script src="/module/define.min.js" data-main="my-main-module"></script>



### Mapping and Bundling

You can create bundles (files containing multiple modules), and/or map modules to
urls outside of the conventional location.

Client-side, this mapping is handled with the `data-uris` attribute on the script
tag, or with a call to `define.uri()`. `define.uri()` takes a map object as its only
parameter, and the `data-uris` attribute expects a JSON array of map objects.

Map objects are of the form:

	{ "uri":"url/of/bundle.js", "ids":[ "module1", "my/module/2" ] }


Server-side and at build time you can generate bundles with the following snippets:

	// Generate a bundle with a specific set of modules included
	require('modules').modules(
		[ 'module1', 'module2' ],
		{ /* options */ }, // specify optional compression, etc.
		function(err, js, modified) {
			// js is a string containing the AMD-wrapped javascript for the modules
			// modified is the most recent modified date among the included modules
		}
	);

	// Generate a bundle with all of the deep dependencies of the modules, excluding
	//  the deep dependencies of another list of modules
	require('modules/lib/bundles').bundle(
		[ 'module1', 'module2' ], // include these and their deep dependencies
		[ 'module3', 'module4' ], // except any of these or their deep dependencies
		{ /* options */ },
		function(err, js, modified) {
		}
	);




## API

### In Browser

#### define.js or define.min.js

These scripts create the `define` function used to create a module environment
in the browser. You can reference the file how ever you'd like; they are in the
`lib` folder in the source code. However, the preferred way is to include a
script tag pointing to the path the middleware is listening to:

	<script src="/path/to/middleware/define.min.js"></script>

* `define(id, dependencies?, factory)` -- Define module `id`. `id` is required
	in this implementation. If the `dependencies` parameter is omitted, the factory
	will not be scanned for `require()` calls, `[ 'require', 'exports', 'module' ]`
	will be used instead.
	See the [AMD wiki](https://github.com/amdjs/amdjs-api/wiki/AMD) for details.
* `define.amd` -- Object denoting AMD compatibility.
* `define.uri(uriMap)` -- Tell define what file to load for specific modules.
	`uriMap` objects look like `{ "uri":"url/of/bundle.js", "ids":[ "moduleid" ] }`.


#### define.shim.js

This is only useful to include first in a bundle that may be loaded before the
`define` or `define.min` script has run. Usually the main bundle includes
`define.min` and the shim is not needed.

* `define(id, dependencies?, factory)` -- Saves the arguments for when `define`
	or `define.min` is loaded.
* `define.amd` -- Object denoting AMD compatibility.


#### In module scope (inside the factory function)

* `exports` -- TODO

* `module` -- TODO
* `module.children` -- TODO
* `module.exports` -- TODO
* `module.filename` -- TODO
* `module.loaded` -- TODO
* `module.id` -- TODO
* `module.require()` -- TODO
* `module.uri` -- TODO

* `require(id)` -- TODO
* `require(id, next)` -- TODO
* `require.cache` -- TODO
* `require.main` -- TODO
* `require.resolve(id)` -- TODO
* `require.toUrl(id)` -- TODO



### In Node.js

#### modules `modules = require('modules')`

Provides middleware and functions to wrap and bundle your modules for use in the
browser.

* `modules.dependencies(id, js, absolute?)` -- Finds all literal `require()` calls
	in a module identified by `id`. `js` is the code for the module as a string. If
	`absolute` is true, the returned dependency ids are made absolute, otherwise they
	are returned as written in the code. Returns an array of module id strings.
* `modules.middleware(options?)` -- Returns an express / connect middleware using
	the `options` passed in.

	* `root` -- Defaults to `process.cwd()`. Base path for modules in the filesystem.
	* `path` -- Defaults to `'/module/'`. Base url path for modules in the browser.
	* `maxAge` -- Defaults to `0`. Seconds the browser should cache the module code.
		If set, will be put in a `Cache-Control: public, max-age=` HTTP header.
	* `compress` -- Defaults to `false`. If a function is specified, it will be
		passed a string of code as the first parameter, and a function as the
		second. It expects the function to be called with either an error or
		null in the first argument, and the compressed code as a string in the
		second. Example:

			compress:function(js, next) {
				var UglifyJS = require('uglify-js');
				js = UglifyJS.minify(js, { fromString:true });
				next(null, js);
			}

	* `map` Defaults to `{}`. Map module ids to files in the filesystem.
		`define`, `define.min`, and `define.shim` will be mapped to their
		locations in `lib` unless explicitly mapped elsewhere. Relative paths
		are resolved against `root`. Example:

			map:{ jquery:'./vendor/jquery.min.js' }

	* `translate` Defaults to `{}`. Translate specific files into CommonJS
		modules. Object keys may be filenames, module ids, or file extensions.
		The function values are passed the module id, the filename, and the
		file contents as a `Buffer`. Example:

			translate: {
				html: function(id, filename, content) {
					var _ = require('underscore');
					content = content.toString('utf8');
					return 'exports.template = ' + _.template(content).source;
				}
			}

	* `forbid` Defaults to `[]`. If the file path to a module matches an entry
		in this list, a `'Forbidden'` error will be passed to the next error
		middleware. Entries can be a string module id (filename starts with
		entry), a regular expression (`exp.test(filename)`) or any object with
		a `test` function property (`obj.test(filename)`). Files outside of the
		`root` directory are always forbidden, unless they have been mapped.
		Mapped files are always allowed. Example:

			forbid: [
				'server', /\.middleware\.js$/,
				{ test:function(filename) {
					return filename.slice(-3) === 'foo';
				} }
			]

	* `nowrap` Defaults to `[ 'uris.json', /\.amd\.js$/i ]`. If a module id
		matches an entry in this list, it is not wrapped with a `define()`
		call. Entries can be a string module id (`entry === id`), a regular
		expression (`exp.test(id)`) or any object with a `test` function
		property (`obj.test(id)`).

* `modules.module(id, options?, next)` -- TODO
* `modules.modules(ids, options? next)` -- TODO


#### bundles `bundles = require('modules/lib/bundles')`

Provides functions for bundling modules with their deep dependencies.

* `bundles.bundle(ids, exclude, options?, next)` -- TODO
* `bundles.dependencies(ids, options?, next)` -- TODO
* `bundles.expand(ids, assumed, options?, next)` -- TODO



## Client-Side Features

 * CommonJS Modules 1.1.1 implementation for in-browser use
 * `module.require` function similar to nodejs implementation
 * `require(id, callback)` for async a la require.js
 * Map module ids to arbirary uris




## Server-Side Features

 * Middleware for express / connect
 * Create bundles of all the deep dependencies of a list of modules
 * Configure minification using your favorite compressor




## Browser Support

* IE 6+, Chrome, Firefox, Safari, Opera
* IE Mobile, Chrome Mobile, Firefox Mobile, Safari Mobile, Opera Mobile

Basically, if you find bugs in any browser I've heard of, I'll fix it.

### Caveats

IE before 8 requires you give the client script tag an id of "modules-define".
All newer browsers will look for `script[data-main]` to find the
`data-main`, `data-path`, and `data-uris` attribute settings.

`data-uris` requires `JSON.parse`, which can be polyfilled in older browsers.



modules was written by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter)).

Some of the motivation for this project can be found in
[this article](http://thetalecrafter.com/2011/09/22/commonjs-in-the-browser/).

