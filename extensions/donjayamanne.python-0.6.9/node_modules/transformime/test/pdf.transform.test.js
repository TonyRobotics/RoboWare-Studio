var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var PDFTransform = require('../src/transformime').PDFTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(PDFTransform)
}

tape('should have the application/pdf mimetype', function (t) {
  beforeEach()
  t.equal(PDFTransform.mimetype, 'application/pdf');
  t.end()
})

tape('should create an link to the pdf file', function (t) {
  beforeEach()
  let base64PDF = "SOMEBASE64PDF"
  let transformed = tf.transform({'application/pdf': base64PDF}, document)
  let html = '<a target="_blank" href="data:application/pdf;base64,SOMEBASE64PDF">View PDF</a>'
  return transformed.then( result => {
    t.equal(result.el.localName, 'a')
    t.equal(result.el.target, '_blank')
    t.equal(result.el.href, 'data:application/pdf;base64,SOMEBASE64PDF')
    t.equal(result.el.innerHTML, 'View PDF')
    t.end()
  })
})
