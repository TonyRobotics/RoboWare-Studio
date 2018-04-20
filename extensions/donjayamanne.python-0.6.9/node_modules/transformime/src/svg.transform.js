"use strict"

/**
 * Converts a Scalable Vector Graphics file to an svgElement for HTML.
 *
 * @param {string} mimetype - The mimetype of the data to be transformed,
 * it is unused by this function but included for a common API.
 * @param {string} data - The svg data to be transformed.
 * @param {Document} document - A Document Object Model to be used for
 * creating an html div element.
 * @return {HTMLElement} - An html div element containing the
 * transformed svg.
 * @throws {Error} - Throws an error if inner html does not have SVG as its
 * first tag name.
 */
export function SVGTransform(mimetype, value, doc) {
    const container = doc.createElement('div')
    container.innerHTML = value

    const svgElement = container.getElementsByTagName('svg')[0]
    if (!svgElement) {
        throw new Error("SVGTransform: Error: Failed to create <svg> element")
    }

    return svgElement
}
SVGTransform.mimetype = 'image/svg+xml'
