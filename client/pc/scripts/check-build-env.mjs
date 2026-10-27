import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const root = path.resolve(process.cwd())
const mode = process.env.NODE_ENV || 'production'
const envPath = path.join(root, `.env.${mode}`)
const fallbackEnvPath = path.join(root, '.env')

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
} else if (fs.existsSync(fallbackEnvPath)) {
    dotenv.config({ path: fallbackEnvPath })
}

const required = [
    'NUXT_API_PREFIX',
    'NUXT_PUBLIC_API_HOST',
    'NUXT_CLIENT'
]

const missing = required.filter((key) => !String(process.env[key] || '').trim())

if (missing.length) {
    console.error('\nPC build environment is incomplete.')
    console.error(`Missing: ${missing.join(', ')}`)
    console.error(`Create pc/.env.${mode} from pc/.env.production.example before building.`)
    process.exit(1)
}

if (String(process.env.NUXT_API_PREFIX).trim() !== '/api') {
    console.error('\nPC build environment is unsafe.')
    console.error('NUXT_API_PREFIX must be /api so packaged PC requests reach the backend API.')
    process.exit(1)
}
