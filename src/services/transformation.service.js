'use strict';
const jsonPath  = require('../utils/jsonPath');
const { evalExpr } = require('../utils/exprEval');
const logger    = require('../utils/logger');
const fileStore = require('../storage/fileStore');

class TransformationService {
  /**
   * Apply transformation rules to raw data and return the output object.
   *
   * Rule order (applied in sequence, each can reference prior output):
   *   1. Field mappings   — copy / rename fields from source
   *   2. Static fields    — hard-coded constant values
   *   3. Computed fields  — math expressions over SOURCE data
   */
  applyTransformation(rawData, transformation) {
    const output = {};

    // If the source wraps everything in a nested 'data' object
    // (e.g. { type, deviceId, data: { d1, d2, … } }) treat that inner
    // object as a fallback scope so users can write 'd1' instead of 'data.d1'.
    const nestedData = (
      rawData &&
      typeof rawData.data === 'object' &&
      rawData.data !== null &&
      !Array.isArray(rawData.data)
    ) ? rawData.data : null;

    // Helper: resolve a source path, falling back to nestedData if needed.
    const resolve = (sourcePath) => {
      const v = jsonPath.get(rawData, sourcePath);
      if ((v !== undefined && v !== null) || !nestedData) return v;
      // Fallback: try the same path inside rawData.data
      const nested = jsonPath.get(nestedData, sourcePath);
      return (nested !== undefined && nested !== null) ? nested : v;
    };

    // ── 1. Field mappings ─────────────────────────────────────────────
    for (const mapping of (transformation.mappings || [])) {
      const val = resolve(mapping.sourcePath);
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

    // ── 2. Static fields ──────────────────────────────────────────────
    for (const field of (transformation.staticFields || [])) {
      jsonPath.set(output, field.targetPath, field.value);
    }

    // ── 3. Computed fields (math expressions over raw source data) ────
    for (const cf of (transformation.computedFields || [])) {
      if (!cf.targetPath || !cf.expression) continue;
      const { result, error } = evalExpr(cf.expression, rawData);
      if (error) {
        logger.warn(`Computed field "${cf.targetPath}" error: ${error}`, {
          transformationId: transformation.id,
          expression: cf.expression,
        });
      }
      if (result !== null && result !== undefined) {
        jsonPath.set(output, cf.targetPath, result);
      }
    }

    return output;
  }

  /**
   * Preview without saving — used by the preview API and the UI.
   */
  preview(sampleData, mappings = [], staticFields = [], computedFields = []) {
    return this.applyTransformation(sampleData, {
      id: 'preview',
      mappings,
      staticFields,
      computedFields,
    });
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
