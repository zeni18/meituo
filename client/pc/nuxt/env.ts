import fs from 'node:fs'
import dotenv from 'dotenv'

const mode = process.env.NODE_ENV || 'development'
const envFiles = [`.env.${mode}`, '.env']

if (mode === 'development') {
    envFiles.push('.env.production')
}

const envFile = envFiles.find((file) => fs.existsSync(file))

if (envFile) {
    dotenv.config({ path: envFile })
}
const ENV_PREFIX = 'NUXT_'
export const getEnvConfig = () => {
    const config: Record<string, any> = {}
    Object.keys(process.env).forEach((evnKey) => {
        if (evnKey.includes(ENV_PREFIX)) {
            const key = evnKey
                .replace(ENV_PREFIX, '')
                .toLowerCase()
                .replace(/\_([A-Za-z])/g, function (all, $1) {
                    return $1.toUpperCase()
                })
            config[key] = process.env[evnKey]
        }
    })
    return config
}
