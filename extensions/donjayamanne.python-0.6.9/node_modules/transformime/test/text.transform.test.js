var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var TextTransform = require('../src/transformime').TextTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(TextTransform)
}

tape('should have the text/plain and jupyter/console-text mimetype', function (t) {
  beforeEach()
  t.deepEqual(TextTransform.mimetype, ['text/plain', 'jupyter/console-text'])
  t.end()
})

tape('transform should create a pre and handle ANSI colors', function (t) {
  beforeEach()
  var text = 'There is no text but \x1b[01;41;32mtext\x1b[00m.\nWoo.'
  var plainText = 'There is no text but text.\nWoo.'
  var innerHTML = 'There is no text but <span style="color:rgb(0, 255, 0);background-color:rgb(187, 0, 0)">text</span>.\nWoo.'
  var transformed = tf.transform({'text/plain': text}, document)
  return transformed.then(results => {
    t.equal(results.el.innerHTML, innerHTML)
    t.equal(results.el.textContent, plainText)
    t.equal(results.el.localName, 'pre')
    t.end()
  })
})
