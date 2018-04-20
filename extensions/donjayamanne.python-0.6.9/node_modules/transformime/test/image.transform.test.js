var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var ImageTransform = require('../src/transformime').ImageTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(ImageTransform)
}

tape('supports multiple mimetypes', function (t) {
  beforeEach()
  t.true(Array.isArray(ImageTransform.mimetype))
  t.end()
})

tape('#transform should create an <img> with the right mimetype', function (t) {
  beforeEach()
  let imageData = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  let p1 = tf.transform({'image/png': imageData}, document).then(results => {
    t.equal(results.el.src, 'data:image/png;base64,' + imageData)
    t.equal(results.el.localName, 'img')
    t.equal(results.el.innerHTML, '')
  })

  let imageData2 = 'R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='
  let p2 = tf.transform({'image/gif': imageData2}, document).then(results => {
    t.equal(results.el.src, 'data:image/gif;base64,' + imageData2)
    t.equal(results.el.localName, 'img')
    t.equal(results.el.innerHTML, '')
    t.end()
  })

  return Promise.all([p1, p2])
})
