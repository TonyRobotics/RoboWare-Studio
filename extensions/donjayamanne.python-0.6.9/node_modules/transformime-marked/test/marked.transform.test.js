import {assert} from 'chai';

import {jsdom} from 'jsdom';

var markdownTransform = require('../src/marked.transform');

describe('text transformer', function() {
    beforeEach(function() {
        this.document = jsdom();
    });

    it('should have the text/markdown mimetype', function() {
        assert.equal(markdownTransform.mimetype, "text/markdown");
    });
    describe('#transform', function() {
        it('should create a div with nice markup', function() {
            let text = `# Title first level

## Title second Level

### Title third level

#### h4

##### h5

###### h6

# h1
## h2
### h3
#### h4
##### h6

This is just a sample paragraph

You can look at different level of nested unorderd list ljbakjn arsvlasc asc asc awsc asc ascd ascd ascd asdc asc

- level 1
    - level 2
    - level 2
    - level 2
        - level 3
        - level 3
            - level 4
                - level 5
                    - level 6
    - level 2

- level 1
- level 1
- level 1

Ordered list

1. level 1
    2. level 1
    3. level 1
        4. level 1
        1. level 1
        2. level 1
            2. level 1
            3. level 1
                4. level 1
                1. level 1
                2. level 1
3. level 1
4. level 1

some Horizontal line

***
and another one

---
Colons can be used to align columns.

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | 1600  |
| col 2 is      | centered      |   12  |
| zebra stripes | are neat      |    1  |

There must be at least 3 dashes separating each header cell.
The outer pipes (|) are optional, and you don't need to make the
raw Markdown line up prettily. You can also use inline Markdown.`;

            let el = markdownTransform('text/markdown', text, this.document);

            assert.equal(el.innerHTML, `<h1 id="title-first-level">Title first level</h1>
<h2 id="title-second-level">Title second Level</h2>
<h3 id="title-third-level">Title third level</h3>
<h4 id="h4">h4</h4>
<h5 id="h5">h5</h5>
<h6 id="h6">h6</h6>
<h1 id="h1">h1</h1>
<h2 id="h2">h2</h2>
<h3 id="h3">h3</h3>
<h4 id="h4">h4</h4>
<h5 id="h6">h6</h5>
<p>This is just a sample paragraph</p>
<p>You can look at different level of nested unorderd list ljbakjn arsvlasc asc asc awsc asc ascd ascd ascd asdc asc</p>
<ul>
<li><p>level 1</p>
<ul>
<li>level 2</li>
<li>level 2</li>
<li>level 2<ul>
<li>level 3</li>
<li>level 3<ul>
<li>level 4<ul>
<li>level 5<ul>
<li>level 6</li>
</ul>
</li>
</ul>
</li>
</ul>
</li>
</ul>
</li>
<li>level 2</li>
</ul>
</li>
<li><p>level 1</p>
</li>
<li>level 1</li>
<li>level 1</li>
</ul>
<p>Ordered list</p>
<ol>
<li>level 1<ol>
<li>level 1</li>
<li>level 1<ol>
<li>level 1</li>
<li>level 1</li>
<li>level 1<ol>
<li>level 1</li>
<li>level 1<ol>
<li>level 1</li>
<li>level 1</li>
<li>level 1</li>
</ol>
</li>
</ol>
</li>
</ol>
</li>
</ol>
</li>
<li>level 1</li>
<li>level 1</li>
</ol>
<p>some Horizontal line</p>
<hr>
<p>and another one</p>
<hr>
<p>Colons can be used to align columns.</p>
<table>
<thead>
<tr>
<th>Tables</th>
<th style="text-align:center">Are</th>
<th style="text-align:right">Cool</th>
</tr>
</thead>
<tbody>
<tr>
<td>col 3 is</td>
<td style="text-align:center">right-aligned</td>
<td style="text-align:right">1600</td>
</tr>
<tr>
<td>col 2 is</td>
<td style="text-align:center">centered</td>
<td style="text-align:right">12</td>
</tr>
<tr>
<td>zebra stripes</td>
<td style="text-align:center">are neat</td>
<td style="text-align:right">1</td>
</tr>
</tbody>
</table>
<p>There must be at least 3 dashes separating each header cell.
The outer pipes (|) are optional, and you don't need to make the
raw Markdown line up prettily. You can also use inline Markdown.</p>
`);
            assert.equal(el.localName, 'div');

        });
    });
});
