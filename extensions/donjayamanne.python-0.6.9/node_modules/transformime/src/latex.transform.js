"use strict"

var mathjaxHelper = require('mathjax-electron')

/**
 * Converts data with LaTeX mimetype to its MathJax representation
 * in an HTML div.
 *
 * @param {string} mimetype - The mimetype of the data to be transformed,
 * it is unused by this function but included for a common API.
 * @param {string} value - The LateX data to be transformed.
 * @param {Document} document - A Document Object Model to be used for
 * creating an html div element.
 * @return {HTMLElement} - An HTML div element containing the processed MathJax.
 */
export function LaTeXTransform(mimetype, value, document) {
    var container = document.createElement('div')
    container.innerHTML = value

    mathjaxHelper.loadAndTypeset(document, container)
    return container
}
LaTeXTransform.mimetype = 'text/latex'
