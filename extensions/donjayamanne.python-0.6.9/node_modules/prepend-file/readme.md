#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]

> Prepend data to a file, creating the file if it not yet exists.


## Install

```sh
$ npm install --save prepend-file
```

## Usage

```js
var prependFile = require('prepend-file');

prependFile('message.txt', 'data to prepend', function (err) {
	if (err) {
		// Error
	}

	// Success
	console.log('The "data to prepend" was prepended to file!');
});
```

## API

### prependFile(filename, data, [options], callback)

```
    * filename String
    * data String | Buffer
    * options Object
        encoding String | Null default = 'utf8'
        mode Number default = 438 (aka 0666 in Octal)
    * callback Function
```

Asynchronously prepend data to a file, creating the file if it not yet exists. The `data` can be a string or a buffer.

### prependFile.sync(filename, data, [options])

The synchronous version of `prependFile`. Returns `undefined`.

## Related

* [prepend-file-cli](https://github.com/martinvd/prepend-file-cli)

## License

MIT © [Hemanth.HM](http://h3manth.com)


[npm-image]: https://badge.fury.io/js/prepend-file.svg
[npm-url]: https://npmjs.org/package/prepend-file
[travis-image]: https://travis-ci.org/hemanth/node-prepend-file.svg?branch=master
[travis-url]: https://travis-ci.org/hemanth/node-prepend-file
[daviddm-image]: https://david-dm.org/hemanth/node-prepend-file.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/hemanth/node-prepend-file
[coveralls-image]: https://coveralls.io/repos/hemanth/node-prepend-file/badge.svg
[coveralls-url]: https://coveralls.io/r/hemanth/node-prepend-file
