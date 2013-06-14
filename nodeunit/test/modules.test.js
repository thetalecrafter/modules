/**
 * Test the server-side modules package
 **/
'use strict';

var modules = require('../../lib/modules'),
	path = require('path'), fs = require('fs'),
	async = require('async');
function parseDefine(js) {
	/*jshint evil:true */
	var args, define = function() { args = arguments; };
	eval(js);
	args.id = args[0];
	args.factory = args[1];
	if (args[2]) {
		args.dependencies = args[1];
		args.factory = args[2];
	}
	return args;
}

module.exports = {
	setUp: function(next) {
		next();
	},

	tearDown: function(next) {
		next();
	},


	// tests finding all of the literal requires
	dependencies: {
		testRelative: function(test) {
			test.expect();
			test.done();
		},
		testAbsolute: function(test) {
			test.expect();
			test.done();
		}
	},


	// tests for the module function
	module: {
		testNoOptions: function(test) {
			test.expect(5);

			var id = module.id.replace(/\.js$/i, '');
			modules.module(id, function(err, js) {
				var args = parseDefine(js.code);

				test.strictEqual(args.id, id, 'The define function should be passed the module\'s id.');
				test.deepEqual(args.dependencies, [
					'require', 'exports', 'module',
					'../../lib/modules',
					'path', 'fs', 'async'
				], 'The define function should be passed the dependencies.');
				test.strictEqual(
					(''+args.factory).replace(/^\s*function\s\([^\)]*?\)\s*\{\s*|\s*}\s*$/g, ''),
					fs.readFileSync(module.filename, 'utf8').trim(),
					'The define factory content should match the file content.');
				test.ok(
					/function\s*\(\s*require\s*,\s*exports\s*,\s*module\s*\)\s*{/.test(''+args.factory),
					'The factory should be expecting require, exports, and module parameters.');
				test.strictEqual(+js.modified, +fs.statSync(module.filename).mtime, '`modified` should match the file\'s modified time.');

				test.done();
			});
		},

		testForbid: function(test) {
			test.expect(5);

			var id = module.id.replace(/\.js$/i, '');
			async.parallel([
				function(next) {
					modules.module(id, { forbid:[ __dirname ] }, function(err, js) {
						test.strictEqual(err && err.message, 'Forbidden', 'Forbidden module gives error.');
						test.ok(!js, 'Forbidden module not loaded.');
						next();
					});
				},
				function(next) {
					modules.module(id, { forbid:[ /\.test$/i ] }, function(err, js) {
						test.ok(err && !js, 'Forbid can be a regular expression.');
						next();
					});
				},
				function(next) {
					modules.module(id, { forbid:[ { test:function(tid) {
							test.strictEqual(tid, id, 'Module id should be passed to test function.');
							return true; // true means this is forbidden'
						} } ] }, function(err, js) {
						test.ok(err && !js, 'Forbid can be an object with a test function.');
						next();
					});
				}
			], test.done);
		},

		testCompress: function(test) {
			test.expect(2);

			var id = module.id.replace(/\.js$/i, '');
			modules.module(id, { compress:function(js, next) {
				test.ok(/^define\(/.test(js), 'Wrapped code is passed to compress.');
				next(null, '"use magic";');
			} }, function(err, js) {
				test.strictEqual(js.code, '"use magic";', 'Compressed string is final js.');

				test.done();
			});
		},

		testMap: function(test) {
			test.expect(2);

			var id = 'themodul';
			async.parallel([
				function(next) {
					modules.module(id, { map:{ 'themodul':module.filename } }, function(err, js) {
						modules.module(module.id, function(err, js2) {
							test.strictEqual(''+parseDefine(js.code).factory, ''+parseDefine(js2.code).factory, 'Map ids to filename strings.');
							next();
						});
					});
				},
				function(next) {
					modules.module(id, { map:{ 'themodul':function(id) { return module.filename; } } }, function(err, js) {
						modules.module(module.id, function(err, js2) {
							test.strictEqual(''+parseDefine(js.code).factory, ''+parseDefine(js2.code).factory, 'Map ids to filename with a function.');
							next();
						});
					});
				}
			], test.done);
		},

		testTranslate: function(test) {
			test.expect(15);

			var id = module.id.replace(/\.js$/i, '');
			function trans(mod, opts, next) {
				test.strictEqual(mod.id, id, 'id should be available.');
				test.strictEqual(mod.filename, module.filename, 'filename should be available.');
				test.strictEqual(mod.buffer.toString('utf8'), fs.readFileSync(module.filename, 'utf8'), 'The file contents should be available.');
				test.ok(opts.translate, 'options should be available.');
				next(null, 'return "success";');
			}
			async.parallel([
				function(next) {
					var argopts = { translate:{} };
					argopts.translate[module.filename] = trans;
					modules.module(id, argopts, function(err, js) {
						test.strictEqual(parseDefine(js.code).factory(), 'success', 'translate by filename.');
						next();
					});
				},
				function(next) {
					var argopts = { translate:{} };
					argopts.translate[id] = trans;
					modules.module(id, argopts, function(err, js) {
						test.strictEqual(parseDefine(js.code).factory(), 'success', 'translate by module id.');
						next();
					});
				},
				function(next) {
					var argopts = { translate:{} };
					argopts.translate.js = trans;
					modules.module(id, argopts, function(err, js) {
						test.strictEqual(parseDefine(js.code).factory(), 'success', 'translate by file extension.');
						next();
					});
				}
			], test.done);
		},

		testNoWrap: function(test) {
			test.expect(5);

			var id = module.id.replace(/\.js$/i, '');
			async.parallel([
				function(next) {
					modules.module(id, { nowrap:[ id ] }, function(err, js) {
						test.ok(!/^define\(/.test(js.code), 'No wrap by id.');
						test.strictEqual(js.code, fs.readFileSync(module.filename, 'utf8'), 'The file should be unaltered.');
						next();
					});
				},
				function(next) {
					modules.module(id, { nowrap:[ /\.test$/i ] }, function(err, js) {
						test.ok(!/^define\(/.test(js.code), 'nowrap can be a regular expression.');
						next();
					});
				},
				function(next) {
					modules.module(id, { nowrap:[ { test:function(tid) {
							test.strictEqual(tid, id, 'Module id should be passed to test function.');
							return true; // true means this is module should not be wrapped
						} } ] }, function(err, js) {
						test.ok(!/^define\(/.test(js.code), 'nowrap can be an object with a test function.');
						next();
					});
				}
			], test.done);
		}
	},


	modules: {
		testModules: function(test) {
			test.expect();
			test.done();
		}
	},


	middleware: {
		testMiddleware: function(test) {
			test.expect();
			test.done();
		}
	}
};

