export {
  CommandCatalogueRevisionSchema,
  CommandCatalogueSchema as CommandCatalogResponseSchema,
  CommandCatalogueSnapshotSchema,
  CommandDescriptorSchema,
  CommandEffectSchema,
  CommandExecutionResultSchema,
  CommandIdSchema,
  CommandOperationSchema,
  CommandResultStatusSchema,
  CommandRiskSchema,
  CommandStateSchema,
  ExecuteCommandRequestSchema,
  commandById
} from '@phoenix/control-deck'

export type {
  CommandCatalogue as CommandCatalogResponse,
  CommandCatalogueRevision,
  CommandCatalogueSnapshot,
  CommandDescriptor,
  CommandEffect,
  CommandExecutionResult,
  CommandId,
  CommandOperation,
  CommandResultStatus,
  CommandRisk,
  CommandState,
  ExecuteCommandRequest
} from '@phoenix/control-deck'

export function gameActionCommandId (actionId: string): string {
  return `command.${actionId}`
}

export function navigationCommandId (destinationId: string): string {
  return `command.navigation.${destinationId}`
}

export function macroCommandId (macroId: string): string {
  return `command.macro.${macroId}`
}
