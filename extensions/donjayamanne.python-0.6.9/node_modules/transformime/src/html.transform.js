'use strict'

/**
  * Converts data with an HTML mimetype to an HTML div element with the
  * appropriate formatting.
  *
  * @param {string} mimetype - The mimetype of the data to be transformed,
  * it is unused by this function but included for a common API.
  * @param {string} data - The html text to be transformed.
  * @param {Document} document - A Document Object Model to be used for
  * creating an html div element.
  * @return {HTMLElement} - A div element for the containing the transformed
  * html.
  */
export function HTMLTransform (mimetype, data, document) {
  try {
    var range = document.createRange()
    return range.createContextualFragment(data)
  } catch (error) {
    console.warn('Environment does not support Range ' +
                 'createContextualFragment, falling back on innerHTML')
    var div = document.createElement('div')
    div.innerHTML = data
    return div
  }

}
HTMLTransform.mimetype = 'text/html'
