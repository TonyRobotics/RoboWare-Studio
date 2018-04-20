var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var SVGTransform = require('../src/transformime').SVGTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(SVGTransform)
}

tape('should have the image/svg+xml mimetype', function (t) {
  beforeEach()
  t.equal(SVGTransform.mimetype, 'image/svg+xml');
  t.end()
})

tape('should create an svg tag', function (t) {
  beforeEach()
  const svg = `
    <?xml version="1.0" standalone="no"?>
    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
    SYSTEM "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
    <svg></svg>
  `;

  return tf.transform({'image/svg+xml': svg}, document).then( result => {
    t.equal(result.el.tagName, 'svg')
    t.end()
  })
})
