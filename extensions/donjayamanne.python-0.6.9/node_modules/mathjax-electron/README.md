# mathjax-electron

[![Greenkeeper badge](https://badges.greenkeeper.io/nteract/mathjax-electron.svg)](https://greenkeeper.io/)

A trimmed down version of the [MathJax](https://www.mathjax.org/) library for use with electron.

`mathjax-electron` allows you to render math inside your application or in a modern browser while keeping the package size at a minimum. To achieve this we provide a preconfigured MathJax environment with only the necessary bits of the MathJax Library included.

The package size is approximately 3 MB compared to 66 MB for a full MathJax installation. If you need support for different output formats and legacy browsers try [`mathjax-node`](https://github.com/mathjax/MathJax-node).

## Installation

```
npm install mathjax-electron
```

## Example
```javascript
var mathjaxHelper = require('mathjax-electron')

var container = document.createElement('div')
container.innerHTML = '$$\\sum\\limits_{i=0}^{\\infty} \\frac{1}{n^2}$$'

mathjaxHelper.loadAndTypeset(document, container)

```

## Documentation
The full API documentation can be found [here](http://nteract.io/mathjax-electron/).
