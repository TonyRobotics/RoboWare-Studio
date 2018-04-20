var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var ScriptTransform = require('../src/transformime').ScriptTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(ScriptTransform)
}

tape('should have the text/javascript mimetype', function (t) {
  beforeEach()
  t.deepEqual(ScriptTransform.mimetype, ['text/javascript', 'application/javascript'])
  t.end()
})

tape('should create a script tag and execute it', function (t) {
  beforeEach()
  var transformed = tf.transform({"text/javascript": "window.x = 1"}, document)
  return transformed.then( result => {
    t.equal(result.el.localName, 'script')
    t.equal(result.el.textContent, "window.x = 1")
    document.body.appendChild(result.el)
    t.equal(window.x, 1)
    t.end()
  })
})
