import path from 'path'
import fsExtra from 'fs-extra'
import dotenv from 'dotenv'
const { existsSync, remove, copy, copySync, readFileSync, writeFileSync } = fsExtra
const cwd = process.cwd()
dotenv.config()

const isSSR = Boolean(process.env.NUXT_SSR)
//打包发布路径，可能会覆盖重要文件，请谨慎改动
const releaseRelativePath = '../server/public/pc'
const distRelativePath = isSSR ? '' : './.output/public'
const distPath = path.resolve(cwd, distRelativePath)
const distSSRFilter = ['.output', 'public', 'static', 'package.json', 'package-lock.json']
const distNotSSRFilter = ['']
const distFilter = joinPath(isSSR ? distSSRFilter : distNotSSRFilter)

function joinPath(target, res = []) {
    target.forEach((src) => {
        res.push(path.join(distPath, src))
    })
    return res
}

const releasePath = path.resolve(cwd, releaseRelativePath)

async function build() {
    if (!isSSR) {
        sanitizeStaticHtml()
    }
    if (existsSync(releasePath)) {
        await remove(releasePath)
    }
    console.log(`文件正在复制 ==> ${releaseRelativePath}`)
    try {
        await copyFile(distPath, releasePath)
    } catch (error) {
        console.log(`\n ${error}`)
    }
    console.log(`文件已复制 ==> ${releaseRelativePath}`)
    syncRootPublicAssets()
}

function sanitizeStaticHtml() {
    const assetDir = path.join(distPath, '_nuxt')
    if (!existsSync(assetDir)) return

    const entryJs = findSingleAsset(assetDir, /^entry\.[a-z0-9]+\.js$/)
    const entryCss = findSingleAsset(assetDir, /^entry\.[a-z0-9]+\.css$/)
    if (!entryJs) return

    const productionScript = `<script type="module" src="/_nuxt/${entryJs}" crossorigin></script>`
    const productionStyle = entryCss ? `<link rel="stylesheet" href="/_nuxt/${entryCss}" crossorigin>` : ''
    const productionTags = [productionStyle, productionScript].filter(Boolean).join('')

    for (const file of findHtmlFiles(distPath)) {
        let html = readFileSync(file, 'utf-8')
        html = html.replace(
            new RegExp('<script\\s+type="module"\\s+src="/_nuxt/@vite/client"\\s+crossorigin></script>', 'g'),
            ''
        )
        html = html.replace(
            new RegExp('<script\\s+type="module"\\s+src="/_nuxt/[^"]*node_modules/nuxt/dist/app/entry\\.js"\\s+crossorigin></script>', 'g'),
            productionTags
        )
        if (!html.includes(`src="/_nuxt/${entryJs}"`)) {
            html = insertBeforeClosingTag(html, 'body', productionScript)
        }
        if (productionStyle && !html.includes(`href="/_nuxt/${entryCss}"`)) {
            html = insertBeforeClosingTag(html, 'head', productionStyle)
        }
        writeFileSync(file, html)
    }
}

function insertBeforeClosingTag(html, tag, content) {
    const closingTag = `</${tag}>`
    const index = html.lastIndexOf(closingTag)
    if (index === -1) {
        return `${html}${content}`
    }
    return `${html.slice(0, index)}${content}${html.slice(index)}`
}

function findSingleAsset(dir, pattern) {
    const files = fsExtra.readdirSync(dir).filter((name) => pattern.test(name)).sort()
    return files[0] || ''
}

function findHtmlFiles(dir) {
    const result = []
    for (const item of fsExtra.readdirSync(dir)) {
        const current = path.join(dir, item)
        const stat = fsExtra.statSync(current)
        if (stat.isDirectory()) {
            result.push(...findHtmlFiles(current))
        } else if (item.endsWith('.html')) {
            result.push(current)
        }
    }
    return result
}

function copyFile(sourceDir, targetDir) {
    return new Promise((resolve, reject) => {
        copy(
            sourceDir,
            targetDir,
            {
                filter(src) {
                    if (src === distPath) return true
                    return distFilter.some((item) => src.includes(item))
                }
            },
            (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            }
        )
    })
}

function syncRootPublicAssets() {
    if (isSSR) return
    const publicPath = path.resolve(cwd, '../server/public')
    const rootAssetDirs = ['_nuxt', 'media', 'aigc_canva']
    for (const dir of rootAssetDirs) {
        const source = path.join(distPath, dir)
        if (!existsSync(source)) continue
        const target = path.join(publicPath, dir)
        if (existsSync(target)) {
            fsExtra.removeSync(target)
        }
        copySync(source, target)
        console.log(`文件已复制 ==> ../server/public/${dir}`)
    }
}

build()
