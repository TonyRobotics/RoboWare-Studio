'use strict'

/**
 * Converts base64 image mimetype data to an HTML img element.
 *
 * @param {string} mimetype - This is the mimetype of the data being
 * provided, it is used for the the source linking.
 * @param {string} data - The image data to be transformed.
 * @param {Document} document - A Document Object Model to be used for
 * creating an html img element.
 * @return {HTMLElement} - An html img element for the given image.
 */
export function ImageTransform (mimetype, data, document) {
  let img = document.createElement('img')
  img.src = 'data:' + mimetype + ';base64,' + data
  return img
}
ImageTransform.mimetype = ['image/png', 'image/jpeg', 'image/gif']
