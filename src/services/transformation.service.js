'use strict';
const jsonPath = require('../utils/jsonPath');
const logger   = require('../utils/logger');
const fileStore = require('../storage/fileStore');

class TransformationService {
  /**
   * Apply transformation rules to raw data and return the output object.
   */
  applyTransformation(rawData, transformation) {
    const output = {};

    for (const mapping of (transformation.mappings || [])) {
      const val = jsonPath.get(rawData, mapping.sourcePath);
      if (val === undefined || val === null) {
        const def = mapping.defaultValue;
        jsonPath.set(output, mapping.targetPath, def !== undefined ? def : null);
        if (def === undefined || def === null) {
          logger.warn(`Missing source path "${mapping.sourcePath}"`, { transformationId: transformation.id });
        }
      } else {
        jsonPath.set(output, mapping.targetPath, val);
      }
    }

    for (const field of (transformation.staticFields || [])) {
      jsonPath.set(output, field.targetPath, field.value);
    }

    return output;
  }

  /**
   * Preview without saving — used by the preview API and the UI.
   */
  preview(sampleData, mappings = [], staticFields = []) {
    return this.applyTransformation(sampleData, { id: 'preview', mappings, staticFields });
  }

  /**
   * Called whenever new source data arrives.
   * Applies every enabled transformation linked to sourceId,
   * then saves transformed output for every linked endpoint.
   */
  processSourceData(sourceId, rawData) {
    const transformations = fileStore.getTransformations().filter(
      t => t.sourceId === sourceId && t.enabled !== false
    );
    const allEndpoints = fileStore.getEndpoints();

    for (const t of transformations) {
      try {
        const output = this.applyTransformation(rawData, t);
        const linked = allEndpoints.filter(e => e.transformationId === t.id && e.enabled !== false);
        for (const ep of linked) {
          fileStore.saveTransformedData(ep.id, output);
        }
        logger.info('Transformation applied', {
          sourceId,
          transformationId: t.id,
          endpoints: linked.length,
        });
      } catch (err) {
        logger.error('Transformation error', { sourceId, transformationId: t.id, error: err.message });
      }
    }
  }
}

module.exports = new TransformationService();
