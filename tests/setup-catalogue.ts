import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('./fixtures/catalogue/', import.meta.url))
delete process.env.PHOENIX_OPENAI_API_KEY
delete process.env.OPENAI_API_KEY
process.env.PHOENIX_SHIP_CATALOGUE_PATH = resolve(directory, 'ships.json')
process.env.PHOENIX_MODULE_CATALOGUE_PATH = resolve(directory, 'modules.json')
process.env.PHOENIX_ENGINEERING_CATALOGUE_PATH = resolve(directory, 'engineering')
