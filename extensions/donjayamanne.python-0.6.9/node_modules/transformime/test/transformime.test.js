/* global describe it beforeEach before */
var test = require('tape')
var Transformime = require('../src/transformime').Transformime
var createTransform = require('../src/transformime').createTransform

/**
* Dummy Transformer for spying on
*/
function DummyTransformer (mimetype, data, doc) {
  let pre = doc.createElement('pre')
  DummyTransformer.lastData = data
  DummyTransformer.lastDoc = doc
  pre.textContent = data
  return pre
}


var tf
var dummyTransformer1, dummyTransformer2, dummyTransformer3, dummyTransformer4, dummyTransformer5

function beforeEach () {
  tf = new Transformime()
  dummyTransformer1 = tf.push(DummyTransformer, 'transformime/dummy1')
  dummyTransformer2 = tf.push(DummyTransformer, 'transformime/dummy2')
  dummyTransformer3 = tf.push(DummyTransformer, 'transformime/dummy3')
  dummyTransformer4 = tf.push(DummyTransformer, 'transformime/a')
  dummyTransformer5 = tf.push(DummyTransformer, 'transformime/a')
}

test('should have default transformers', function (t) {
  tf = new Transformime()
  t.true(Array.isArray(tf.transformers))
  t.end()
})

test('should have called our DummyRender', function (t) {
  beforeEach()
  var elPromise = tf.transform({'transformime/dummy1': 'dummy-data'}, document)

  elPromise.then((results) => {
    t.equal(DummyTransformer.lastData, 'dummy-data')
    t.equal(DummyTransformer.lastDoc, document)

    // el should be an HTMLElement
    t.true(results.el instanceof document.defaultView.HTMLElement)
    t.end()
  })
})
test('should fail when the mimetype is not known', function (t) {
  let elPromise = tf.transform({'transformime/unknown': 'my-data'}, document)

  elPromise.catch((err) => {
    t.equal(err.message, 'Transformer(s) for transformime/unknown not found.')
    t.end()
  })
})
test('when called with all mimetypes in the mimebundle, only return lastmost', function (t) {
  let mimeBundle = {
    'transformime/dummy1': 'dummy data 1',
    'transformime/dummy2': 'dummy data 2',
    'transformime/dummy3': 'dummy data 3'
  }

  var elPromise = tf.transform(mimeBundle, document)
  elPromise.then((results) => {
    t.equal(DummyTransformer.lastData, 'dummy data 3')
    t.equal(results.mimetype, 'transformime/dummy3')
    t.equal(results.el.textContent, 'dummy data 3')
    t.end()
  })
})
test('when called with a lesser mimebundle, choose most rich', function (t) {
  let mimeBundle = {
    'transformime/dummy1': 'dummy data 1',
    'transformime/dummy2': 'dummy data 2'
  }

  let elPromise = tf.transform(mimeBundle, document)
  elPromise.then(() => {
    t.equal(DummyTransformer.lastData, 'dummy data 2')
    t.end()
  })
})
test("when called with mimetypes it doesn't know, it uses supported mimetypes", function (t) {
  let mimeBundle = {
    'video/quicktime': 'cat vid',
    'transformime/dummy1': 'dummy data 1',
    'application/x-shockwave-flash': 'flashy',
    'application/msword': 'DOC',
    'application/zip': 'zippy'
  }

  let elPromise = tf.transform(mimeBundle, document)
  elPromise.then(() => {
    t.equal(DummyTransformer.lastData, 'dummy data 1')
    t.end()
  })
})
test('get should get the right transformer for a given mimetype', function (t) {
  let transformer = tf.get('transformime/dummy1')
  t.equal(dummyTransformer1, transformer)
  t.end()
})
test('get should return undefined with an unknown mimetype', function (t) {
  t.equal(tf.get('cats/calico'), undefined, "found a transformer when I shouldn't have")
  t.end()
})
test('get respects priority order', function (t) {
  beforeEach()
  let transformer = tf.get('transformime/a')
  t.equal(dummyTransformer5, transformer)
  t.end()
})

test('createTransform returns a transform function for our dummyTransformer', function (t) {
  function dummyTransformer(mimetype, data, document) {
    dummyTransformer.doc = document
    let div = document.createElement('div')
    div.innerHTML = data
    return div
  }
  dummyTransformer.mimetype = 'transformime/dummy'

  var transform = createTransform([dummyTransformer])

  transform({'transformime/dummy': 'dummy-data'}).then((result) => {
    t.equal(dummyTransformer.doc, document)
    t.equal(result.mimetype, 'transformime/dummy')
    t.equal(result.el.innerHTML, 'dummy-data')
    t.end()
  })
})
