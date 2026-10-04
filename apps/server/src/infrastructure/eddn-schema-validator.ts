import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv-draft-04'
import type { ValidateFunction } from 'ajv'
import { z } from 'zod'
import { EDDN_MAX_MESSAGE_BYTES, EDDN_SCHEMA_VERSIONS, type EddnMessage } from '../domain/eddn.js'

export class EddnSchemaValidator {
  private readonly validators = new Map<string, ValidateFunction>()

  public constructor (directory: string) {
    const ajv = new Ajv.default({ strict: false, allErrors: false })
    ajv.addFormat('date-time', value => z.iso.datetime({ offset: true }).safeParse(value).success)
    for (const [name, version] of Object.entries(EDDN_SCHEMA_VERSIONS)) {
      const schema = JSON.parse(readFileSync(join(directory, `${name}-v${version}.0.json`), 'utf8'))
      const ref = `https://eddn.edcd.io/schemas/${name}/${version}/test`
      // The test schema differs only in id/$schemaRef; keep the pinned upstream file unchanged.
      schema.id = ref
      schema.properties.$schemaRef.enum = [ref]
      this.validators.set(ref, ajv.compile(schema))
    }
  }

  public valid (message: EddnMessage): boolean {
    return Buffer.byteLength(JSON.stringify(message)) <= EDDN_MAX_MESSAGE_BYTES &&
      this.validators.get(message.$schemaRef)?.(message) === true
  }
}
