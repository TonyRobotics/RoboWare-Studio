var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var LaTeXTransform = require('../src/transformime').LaTeXTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(LaTeXTransform)
}

tape('should have the text/latex mimetype', function (t) {
  beforeEach()
  t.equal(LaTeXTransform.mimetype, 'text/latex')
  t.end()
})

tape('should create a div for the latex output', function (t) {
  beforeEach()
  var latex = '$$\\sum\\limits_{i=0}^{\\infty} \\frac{1}{n^2}$$'

  var transformed =  tf.transform({'text/latex': latex}, document);
  return transformed.then( result => {
    t.equal(result.el.localName, 'div')
    t.equal(result.el.textContent, latex)
    t.end()
  })
})
