# transformime

[![Build Status](https://travis-ci.org/nteract/transformime.svg)](https://travis-ci.org/nteract/transformime)

![Optimus MIME](https://cloud.githubusercontent.com/assets/6437976/8895696/db154a04-3397-11e5-91ca-296b957658a6.png)

Transforms MIMEtype+data to HTML Elements

Intended to be used in context of Jupyter and IPython projects, particularly by display areas.

## Installation

```
npm install transformime
```

## Usage

Transformime works in the browser (via browserify), converting a mimebundle (MIME type + data) into HTML Elements. `transformime.transform` returns promises for all the HTMLElements.

### Using the helper function `createTransform`

```javascript
var transformime = require("transformime");

var transform = transformime.createTransform();

transform({
    "text/plain": "Hello, World!",
}).then(function onSuccess(result) {
    mimeType = result.mimetype;
    htmlElement = result.el;
    console.log("Tranformime: Result:", mimeType, htmlElement);
}, function onError(err) {
    console.error("Transformime: Error:", err);
});
```

### Transform a single mimetype

```javascript
> t = new transformime.Transformime();
> p1 = t.transform({'text/html': '<h1>Woo</h1>'}, document)
Promise { <pending> }
> p1
Promise {
  { mimetype: 'text/html',
  el:
   { _events: {},
     _childNodes: [Object],
     _childNodesList: null,
     _ownerDocument: [Object],
     _childrenList: null,
     _version: 1,
     _parentNode: null,
     _memoizedQueries: {},
     _readonly: false,
     _namespaceURI: 'http://www.w3.org/1999/xhtml',
     _prefix: null,
     _localName: 'div',
     _attributes: {},
     _settingCssText: false,
     _style: [Object] } } }
> p1.then(function(result){
...   console.log(result.el.innerHTML);
...   console.log(result.el.textContent);
... });
Promise { <pending> }
> <h1>Woo</h1>
Woo
```

Images get handled as base64 encoded data and become embedded elements.

```javascript
> // Send an image over
> p2 = t.transform({'image/png': 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}, document)
> p2.then(function(result){
...     console.log(result.el.src);
... })
data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
```

### Transform the richest element
```javascript
> var mimes = {'text/html': '<code>import this</code>', 'text/plain': 'import this'}
> var p3 = t.transform(mimes, document);
> p3.then(function(result){
...    console.log(result.mimetype + ": " + result.el.innerHTML)
... })
text/html: <code>import this</code>
```

### Working with iframes

```javascript
> // Create an arbitrary iframe and slap it in the body of the document
> var iframe = document.createElement("iframe");
> document.querySelector('body').appendChild(iframe);
> var idoc = iframe.contentDocument;
> // Pass the iframe's document as the document context for the created element
> var p5 = t.transform({'text/html': '<h1>mimetic</h1>'}, idoc);
> p5.then(function(result){
... idoc.querySelector('body').appendChild(result.el);
... })
> idoc.querySelector('body').innerHTML
'<div><h1>mimetic</h1></div>'
```

## Documentation
The full API documentation can be found [here](http://nteract.io/transformime/).

## Development

```
git clone https://github.com/nteract/transformime
cd transformime
npm install
npm run build
```
