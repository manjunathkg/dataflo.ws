/**
 * Adopted from jquery's extend method. Under the terms of MIT License.
 *
 * http://code.jquery.com/jquery-1.4.2.js
 *
 * Modified by Brian White to use Array.isArray instead of the custom isArray method
 */
module.exports.extend = function extend() {
	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
	// Handle a deep copy situation
	if (typeof target === "boolean") {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}
	// Handle case when target is a string or something (possible in deep copy)
	if (typeof target !== "object" && !typeof target === 'function')
		target = {};
	var isPlainObject = function(obj) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if (!obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval)
			return false;
		var has_own_constructor = hasOwnProperty.call(obj, "constructor");
		var has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
		// Not own constructor property must be Object
		if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
			return false;
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var last_key;
		for (key in obj)
			last_key = key;
		return typeof last_key === "undefined" || hasOwnProperty.call(obj, last_key);
	};
	for (; i < length; i++) {
		// Only deal with non-null/undefined values
		if ((options = arguments[i]) !== null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];
				// Prevent never-ending loop
				if (target === copy)
					continue;
				// Recurse if we're merging object literal values or arrays
				if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
					var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);
					// Don't bring in undefined values
				} else if (typeof copy !== "undefined")
					target[name] = copy;
			}
		}
	}
	// Return the modified object
	return target;
}

Number.prototype.hours = Number.prototype.hour
	= function () {return this * 60 * 60 * 1e3}
Number.prototype.minutes = Number.prototype.minute
	= function () {return this * 60 * 1e3}
Number.prototype.seconds = Number.prototype.second
	= function () {return this * 1e3}

Number.prototype.times = function (cb) {
	var a = [];
	for (var i = 0; i < this; i++)
		a[i] = cb (i);
	return a;
}

var pathToVal = module.exports.pathToVal = function (dict, path, value) {
//	console.log ('pathToVal ('+ dict + ', '+ path + ', '+value+')');
	var chunks = path.split ('.');
	if (chunks.length == 1) {
		var oldValue = dict[chunks[0]];
		if (value !== void(0))
			dict[chunks[0]] = value;
//		console.log (''+oldValue);
		return oldValue;
	}
	return pathToVal (dict[chunks.shift()], chunks.join('.'), value)
}


String.prototype.interpolate = function (dict, marks) {
	if (!marks)
		marks = {
			start: '{$', end: '}', path: '.'
		};
	
	var result;
	
	var template = this;
	
	var pos = this.indexOf (marks.start);
	while (pos > -1) {
		var end = (result || this).indexOf (marks.end, pos);
		var str = (result || this).substr (pos + 2, end - pos - 2);
		
		// console.log ("found replacement: key => ???, requires => $"+this+"\n");
		
		var fix;
		if (str.indexOf (marks.path) > -1) { //  treat as path
			//  warn join ', ', keys %{$self->var};
			fix = pathToVal (dict, str);
		} else { // scalar
			fix = dict[str];
		}
		
		if (fix === void(0))
			throw (result || this);
		
		// warn "value for replace is: $fix\n";
		
		if (pos == 0 && end == ((result || this).length - 1)) {
			result = fix;
		} else {
			result = (result || this).substr (0, pos) + fix + (result || this).substr (end + 1);
//			console.log ('!!!', (result || this).toString(), fix.toString(), pos, end, end - pos + 1);
		}
		
		if ((result || this).indexOf)
			pos = (result || this).indexOf (marks.start, end);
		else
			break;
	}
	
	return result;

};

var path = require ('path');

var io = require (path.join ('IO', 'Easy'));

var project = function () {
	// TODO: root directory object
	var script = process.argv[1];
	
//	console.log (script);
	
	var root = new io (script.match (/(.*)\/(bin|t|lib)\//)[1]);
//	console.log (root);
	
	this.root = root;
	
	// TODO:
	// 1. detect instance name after reading var/instance
	// 2. load configuration
	// 3. load local fixup for configuration and override default

	// TODO: walk filetree to find directory root if script located in
	// subdir of bin or t
//	console.log (root);
	
	// TODO: emit ready event on ready
}



global.project = new project ();


