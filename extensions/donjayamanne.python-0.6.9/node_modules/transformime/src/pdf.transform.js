"use strict"

/**
 * Transforms base 64 encoded PDF --> <a href="data:application/pdf;base64,...">
 * which is the (current) Jupyter notebook version of the element.
 * This one returns a little link you can click.
 *
 * @param {string} mimetype - The mimetype of the data to be transformed,
 * it is unused by this function but included for a common API.
 * @param  {string} base64PDF - A base64 encoded PDF.
 * @param  {Document} document - A Document Object Model (e.g. window.document)
 * @return {HTMLElement} - A link element to the given PDF.
 */
export function PDFTransform(mimetype, base64PDF, document) {
    var a = document.createElement('a')
    a.target = '_blank'
    a.textContent = "View PDF"
    a.href = 'data:application/pdf;base64,' + base64PDF

    return a
}
PDFTransform.mimetype = 'application/pdf'
