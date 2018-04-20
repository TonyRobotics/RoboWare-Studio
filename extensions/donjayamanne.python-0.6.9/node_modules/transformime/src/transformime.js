'use strict'

import { TextTransform } from './text.transform'
import { ImageTransform } from './image.transform'
import { HTMLTransform } from './html.transform'
import { SVGTransform } from './svg.transform'
import { PDFTransform } from './pdf.transform'
import { ScriptTransform } from './script.transform'
import { LaTeXTransform } from './latex.transform'
import { MarkdownTransform } from './commonmark.transform'
/**
 * Transforms mimetypes into HTMLElements
 */
class Transformime {

  /**
   * Public constructor
   * @param  {function[]} transformers - list of transformers, in reverse priority order.
   */
  constructor (transformers) {
    // Initialize instance variables.
    this.transformers = []
    this.push(TextTransform)
    this.push(ImageTransform)
    this.push(SVGTransform)
    this.push(HTMLTransform)
    this.push(PDFTransform)
    this.push(ScriptTransform)
    this.push(MarkdownTransform)
    this.push(LaTeXTransform)
    if (transformers) transformers.forEach((transformer) => { this.push(transformer) })
  }
  /**
   * Transforms a mime bundle, using the richest available representation,
   * into an HTMLElement.
   * @param  {any}      bundle - {mimetype1: data1, mimetype2: data2, ...}
   * @param  {Document} document - Any of window.document, iframe.contentDocument
   * @return {Promise<{mimetype: string, el: HTMLElement}>}
   */
  transform (bundle, document) {
    if (this.transformers.length <= 0) {
      // Empty transformers
      return Promise.reject(new Error('No transformers configured'))
    }

    if (Object.keys(bundle).length <= 0) {
      return Promise.reject(new Error('MIME Bundle empty'))
    }

    let richMimetype
    let richTransformer

    // Choose the last transformer as the most rich
    for (let transformer of this.transformers) {
      if (transformer.mimetype) {
        // Make sure the transformer's mimetype is in array format.
        let transformer_mimetypes = transformer.mimetype
        if (!Array.isArray(transformer_mimetypes)) {
          transformer_mimetypes = [transformer_mimetypes]
        }

        for (let transformer_mimetype of transformer_mimetypes) {
          if (transformer_mimetype in bundle) {
            richMimetype = transformer_mimetype
            richTransformer = transformer
          }
        }
      }
    }

    if (richMimetype && richTransformer) {
      // Don't assume the transformation will return a promise.  Also
      // don't assume the transformation will succeed.
      try {
        return Promise.resolve(richTransformer.call(richTransformer,
          richMimetype, bundle[richMimetype], document)).then(el => {
            return { mimetype: richMimetype, el: el }
          })
      } catch (e) {
        return Promise.reject(e)
      }
    } else {
      return Promise.reject(new Error('Transformer(s) for ' + Object.keys(bundle).join(', ') + ' not found.'))
    }
  }

  /**
   * Deletes all transformers by mimetype.
   * @param {string|string[]} mimetype - mimetype the data type (e.g. text/plain, text/html, image/png)
   */
  del (mimetype) {
    // Convert mimetype to an array.
    let mimetypes = mimetype
    if (!Array.isArray(mimetypes)) {
      mimetypes = [mimetypes]
    }

    // Remove each mimetype.
    for (mimetype of mimetypes) {
      for (let i = 0; i < this.transformers.length; i++) {
        var transformer = this.transformers[i]

        // If the mimetype matches the one we want to remove, remove it.
        if (mimetype === transformer.mimetype) {
          this.transformers.splice(i, 1)
          i--

        // If the mimetype we want to remove is in the list of the
        // mimetypes supported by the transformer, remove it from the list.
        // If the transformer mimetype list is then empty, remove the
        // transformer.
        } else if (Array.isArray(transformer.mimetype) && mimetype in transformer.mimetype) {
          if (transformer.mimetype.length === 1) {
            this.transformers.splice(i, 1)
            i--
          } else {
            transformer.mimetype.splice(transformer.mimetype.indexOf(mimetype), 1)
          }
        }
      }
    }
  }

  /**
   * Gets a transformer matching the mimetype
   * @param {string} mimetype - the data type (e.g. text/plain, text/html, image/png)
   * @return {function} Matching transformer
   */
  get (mimetype) {
    // Loop through the transformers array in reverse.
    for (let i = this.transformers.length - 1; i >= 0; i--) {
      let transformer = this.transformers[i]

      // Get an array of the mimetypes that the transformer supports.
      let transformer_mimetypes = transformer.mimetype
      if (!Array.isArray(transformer_mimetypes)) {
        transformer_mimetypes = [transformer_mimetypes]
      }

      // Check if any of the mimetypes match the one we are looking for.
      for (let transformer_mimetype of transformer_mimetypes) {
        if (mimetype === transformer_mimetype) {
          return transformer
        }
      }
    }
  }

  /**
   * Sets a transformer matching the mimetype
   * @param {string|string[]} mimetype - the data type (e.g. text/plain, text/html, image/png)
   * @param {function} transformer
   * @return {function} inserted transformer function (may be different than arg)
   */
  set (mimetype, transformer) {
    this.del(mimetype)
    return this.push(transformer, mimetype)
  }

  /**
   * Appends a transformer to the transformer list.
   * @param  {function} transformer
   * @param  {string|string[]} mimetype
   * @return {function} inserted transformer function (may be different than arg)
   */
  push (transformer, mimetype) {
    // If the mimetype specified is different than the mimetype of the
    // transformer, make a copy of the transformer and set the new mimetype
    // on the copy.
    let transform = transformer
    if (mimetype && transformer.mimetype !== mimetype) {
      transform = this._proxy(transformer, mimetype)
    }

    // Verify a mimetype is set on the transformer.
    if (!transform.mimetype) throw Error('Could not infer transformer mimetype')

    this.transformers.push(transform)
    return transform
  }

  /**
   * Create a proxy to a transformer, using another mimetype.
   * @param  {function} transformer
   * @param  {string|string[]} mimetype
   * @return {function} transformer
   */
  _proxy (transformer, mimetype) {
    let transform = function (...args) { return transformer.call(this, ...args) }
    transform.mimetype = mimetype
    return transform
  }
}

/**
* Helper to create a function that transforms a MIME bundle into an HTMLElement
* using the given document and list of transformers.
* @param  {function[]} [transformers] List of transformers, in reverse priority order.
* @param  {Document}   [doc]          E.g. window.document, iframe.contentDocument
* @return {function}
*/
function createTransform (transformers, doc) {
  const t = new Transformime(transformers)

  if (!doc) {
      doc = document
  }

  /**
   * Transforms a MIME bundle into an HTMLElement.
   * @param  {object} bundle {mimetype1: data1, mimetype2: data2, ...}
   * @return {Promise<{mimetype: string, el: HTMLElement}>}
   */
  return function transform(bundle) {
    return t.transform(bundle, doc)
  }
}

export {
    Transformime,
    TextTransform,
    ImageTransform,
    HTMLTransform,
    SVGTransform,
    PDFTransform,
    ScriptTransform,
    LaTeXTransform,
    MarkdownTransform,
    createTransform
};
