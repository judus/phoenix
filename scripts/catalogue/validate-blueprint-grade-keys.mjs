// Only fresh official output is constrained here. The retained catalogue reader
// keeps its existing parseInt compatibility and must not silently rekey recipes.
export function validateBlueprintGradeKeys(blueprints) {
  for (const [symbol, blueprint] of Object.entries(blueprints)) {
    for (const key of Object.keys(blueprint.grades ?? {})) {
      if (!/^[1-5]$/u.test(key)) {
        throw new Error(`Blueprint ${symbol} has unsupported grade key ${JSON.stringify(key)}. Expected a canonical grade key from "1" to "5"; the existing catalogue snapshot has not been replaced.`)
      }
    }
  }
}
