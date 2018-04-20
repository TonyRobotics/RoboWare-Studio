var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var HTMLTransform = require('../src/transformime').HTMLTransform

var tf

tape('should have the text/html mimetype', function (t) {
  beforeEach()
  t.equals(HTMLTransform.mimetype, 'text/html', 'has corret mime type')
  t.end()
})

tape('should create a div with all the passed in elements', function (t) {
  beforeEach()
  var htmlText = '<h1>This is great</h1>'
  return tf.transform({'text/html': htmlText}, document).then(results => {
    t.equals(results.el.firstChild.innerHTML, 'This is great', 'inner text should be there')
    t.end()
  })
})

tape('should execute script tag', function (t) {
  beforeEach()
  var htmlText = '<script>window.y=3;</script>'
  return tf.transform({'text/html': htmlText}, document).then(results => {
    document.body.appendChild(results.el)
    t.equals(window.y, 3, 'this will fail on safari')
    t.end()
  })
})

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(HTMLTransform)
}
