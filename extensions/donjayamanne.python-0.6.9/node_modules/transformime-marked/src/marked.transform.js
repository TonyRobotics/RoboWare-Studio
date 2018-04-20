"use strict";

var marked = require('marked');

var markdownTransform = function(){
    // Stick reader and writer in a closure so they only get created once.

    var renderer = new marked.Renderer();

    marked.setOptions({
        renderer: renderer,
        gfm: true,
        tables: true,
    });

    return function(mimetype, data, document) {
        var div = document.createElement("div");

        div.innerHTML = marked(data);

        return div;
    };
}();

markdownTransform.mimetype = 'text/markdown';

export default markdownTransform;
