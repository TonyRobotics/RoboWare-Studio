"use strict"

var Anser = require('anser')
var escapeCarriageReturn = require('escape-carriage')

/**
 * Converts console text or plaintext to an HTML pre element.
 *
 * @param {string} mimetype - The mimetype of the data to be transformed,
 * it is unused by this function but included for a common API.
 * @param {string} value - The text data to be transformed.
 * @param {Document} document - A Document Object Model to be used for
 * creating an html pre element.
 * @return {HTMLElement} - A pre element for the given text
 */
export function TextTransform(mimetype, value, document) {
  var el = document.createElement('pre')
  var esc = Anser.escapeForHtml(value)
  esc = escapeCarriageReturn(esc)
  el.innerHTML = Anser.ansiToHtml(esc)
  return el
}
TextTransform.mimetype = ['text/plain', 'jupyter/console-text']
