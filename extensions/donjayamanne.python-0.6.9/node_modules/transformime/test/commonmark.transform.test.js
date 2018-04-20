var tape = require('tape')
var Transformime = require('../src/transformime').Transformime
var MarkdownTransform = require('../src/transformime').MarkdownTransform

var tf

function beforeEach () {
  tf = new Transformime()
  tf.transformers = []
  tf.push(MarkdownTransform)
}

tape('should have the text/markdown mimetype', function (t) {
  beforeEach()
  t.equal(MarkdownTransform.mimetype, 'text/markdown')
  t.end()
})

tape('should create a div with nice markup', function (t) {
  beforeEach()
  let text = `# Ratification of Markdown Association
We are present here because we believe in unification
across all markdowns, whether common, flavored like
GitHub, or used to help an undergrad do their homework
via StackOverflow. It is of *great importance* that we
unify for the [sake of the sciences](https://jupyter.org),
the arts, and be able to express in rich text our thoughts,
feelings, and desires.
## Speaking for some
We need markdown to work
* On the web
* On your hard drive
* Hanging upside down from a bridge
* In letters to your lovers`
  text = text + "\n\n```bash\nnpm install transformime-commonmark\n```\n"

  let markdown = `<h1>Ratification of Markdown Association</h1>
<p>We are present here because we believe in unification
across all markdowns, whether common, flavored like
GitHub, or used to help an undergrad do their homework
via StackOverflow. It is of <em>great importance</em> that we
unify for the <a href="https://jupyter.org">sake of the sciences</a>,
the arts, and be able to express in rich text our thoughts,
feelings, and desires.</p>
<h2>Speaking for some</h2>
<p>We need markdown to work</p>
<ul>
<li>On the web</li>
<li>On your hard drive</li>
<li>Hanging upside down from a bridge</li>
<li>In letters to your lovers</li>
</ul>
<pre><code class="language-bash">npm install transformime-commonmark
</code></pre>
`

  var transformed = tf.transform({'text/markdown': text}, document)
  return transformed.then(results => {
    t.equal(results.el.innerHTML, markdown)
    t.equal(results.el.localName, 'div')
    t.end()
  })
})
