<template>
    <div
        ref="containerRef"
        :class="['short-drama-grainient-placeholder', { 'is-compact': compact, 'is-fallback': webglFailed }]"
        :style="{ '--grainient-animation-delay': animationDelay }"
    >
        <div class="short-drama-grainient-placeholder__label">{{ label }}</div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
    label?: string
    compact?: boolean
    color1?: string
    color2?: string
    color3?: string
    timeSpeed?: number
    colorBalance?: number
    warpStrength?: number
    warpFrequency?: number
    warpSpeed?: number
    warpAmplitude?: number
    blendAngle?: number
    blendSoftness?: number
    rotationAmount?: number
    noiseScale?: number
    grainAmount?: number
    grainScale?: number
    grainAnimated?: boolean
    contrast?: number
    gamma?: number
    saturation?: number
    centerX?: number
    centerY?: number
    zoom?: number
    webgl?: boolean
}>(), {
    label: '生成中',
    compact: false,
    color1: '#526f73',
    color2: '#1e3248',
    color3: '#07131f',
    timeSpeed: 1.05,
    colorBalance: -0.01,
    warpStrength: 2.2,
    warpFrequency: 5.4,
    warpSpeed: 3.4,
    warpAmplitude: 30,
    blendAngle: 106,
    blendSoftness: 0.23,
    rotationAmount: 490,
    noiseScale: 2.7,
    grainAmount: 0.07,
    grainScale: 2.5,
    grainAnimated: false,
    contrast: 1.38,
    gamma: 0.9,
    saturation: 1.2,
    centerX: 0.13,
    centerY: -0.38,
    zoom: 1.55,
    webgl: true
})

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`

const containerRef = ref<HTMLElement | null>(null)
const webglFailed = ref(false)
const animationDelay = ref('0s')

let renderer: any = null
let program: any = null
let mesh: any = null
let canvas: HTMLCanvasElement | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let resizeHandler: (() => void) | null = null
let raf = 0
let visible = true
let pageVisible = true
let startTime = 0

const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return new Float32Array([1, 1, 1])
    return new Float32Array([
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
    ])
}

const updateUniforms = () => {
    if (!program?.uniforms) return
    const uniforms = program.uniforms
    uniforms.uTimeSpeed.value = props.timeSpeed
    uniforms.uColorBalance.value = props.colorBalance
    uniforms.uWarpStrength.value = props.warpStrength
    uniforms.uWarpFrequency.value = props.warpFrequency
    uniforms.uWarpSpeed.value = props.warpSpeed
    uniforms.uWarpAmplitude.value = props.warpAmplitude
    uniforms.uBlendAngle.value = props.blendAngle
    uniforms.uBlendSoftness.value = props.blendSoftness
    uniforms.uRotationAmount.value = props.rotationAmount
    uniforms.uNoiseScale.value = props.noiseScale
    uniforms.uGrainAmount.value = props.grainAmount
    uniforms.uGrainScale.value = props.grainScale
    uniforms.uGrainAnimated.value = props.grainAnimated ? 1 : 0
    uniforms.uContrast.value = props.contrast
    uniforms.uGamma.value = props.gamma
    uniforms.uSaturation.value = props.saturation
    uniforms.uCenterOffset.value = new Float32Array([props.centerX, props.centerY])
    uniforms.uZoom.value = props.zoom
    uniforms.uColor1.value = hexToRgb(props.color1)
    uniforms.uColor2.value = hexToRgb(props.color2)
    uniforms.uColor3.value = hexToRgb(props.color3)
}

const resize = () => {
    const container = containerRef.value
    if (!container || !renderer || !program || !mesh) return
    const rect = container.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    renderer.setSize(width, height)
    const resolution = program.uniforms.iResolution.value
    resolution[0] = renderer.gl.drawingBufferWidth
    resolution[1] = renderer.gl.drawingBufferHeight
    renderer.render({ scene: mesh })
}

const stop = () => {
    if (!raf) return
    cancelAnimationFrame(raf)
    raf = 0
}

const loop = (time: number) => {
    if (!program || !renderer || !mesh) return
    program.uniforms.iTime.value = (time - startTime) * 0.001
    renderer.render({ scene: mesh })
    raf = requestAnimationFrame(loop)
}

const start = () => {
    if (raf || !visible || !pageVisible || !program) return
    raf = requestAnimationFrame(loop)
}

const handleVisibilityChange = () => {
    pageVisible = !document.hidden
    pageVisible ? start() : stop()
}

const destroy = () => {
    stop()
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    resizeObserver = null
    intersectionObserver = null
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
        resizeHandler = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (canvas?.parentNode) {
        canvas.parentNode.removeChild(canvas)
    }
    const gl = renderer?.gl
    if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    renderer = null
    program = null
    mesh = null
    canvas = null
}

onMounted(async () => {
    const globalKey = '__shortDramaGrainientAnimationStart'
    const root = window as typeof window & Record<string, number>
    if (!root[globalKey]) root[globalKey] = performance.now()
    const duration = props.webgl ? 5.8 : 3.4
    const elapsed = ((performance.now() - root[globalKey]) / 1000) % duration
    animationDelay.value = `${-elapsed}s`

    const container = containerRef.value
    if (!container) return
    if (!props.webgl) return

    try {
        const { Renderer, Program, Mesh, Triangle } = await import('ogl')
        renderer = new Renderer({
            webgl: 2,
            alpha: true,
            antialias: false,
            dpr: Math.min(window.devicePixelRatio || 1, 2)
        })

        canvas = renderer.gl.canvas as HTMLCanvasElement
        canvas.className = 'short-drama-grainient-placeholder__canvas'
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        container.appendChild(canvas)

        const geometry = new Triangle(renderer.gl)
        program = new Program(renderer.gl, {
            vertex,
            fragment,
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new Float32Array([1, 1]) },
                uTimeSpeed: { value: 0.25 },
                uColorBalance: { value: 0 },
                uWarpStrength: { value: 1 },
                uWarpFrequency: { value: 5 },
                uWarpSpeed: { value: 2 },
                uWarpAmplitude: { value: 50 },
                uBlendAngle: { value: 0 },
                uBlendSoftness: { value: 0.05 },
                uRotationAmount: { value: 500 },
                uNoiseScale: { value: 2 },
                uGrainAmount: { value: 0.1 },
                uGrainScale: { value: 2 },
                uGrainAnimated: { value: 0 },
                uContrast: { value: 1.5 },
                uGamma: { value: 1 },
                uSaturation: { value: 1 },
                uCenterOffset: { value: new Float32Array([0, 0]) },
                uZoom: { value: 0.9 },
                uColor1: { value: new Float32Array([1, 1, 1]) },
                uColor2: { value: new Float32Array([1, 1, 1]) },
                uColor3: { value: new Float32Array([1, 1, 1]) }
            }
        })
        mesh = new Mesh(renderer.gl, { geometry, program })
        updateUniforms()

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(resize)
            resizeObserver.observe(container)
        } else {
            resizeHandler = resize
            window.addEventListener('resize', resizeHandler)
        }
        resize()

        startTime = performance.now()
        pageVisible = !document.hidden
        document.addEventListener('visibilitychange', handleVisibilityChange)

        if (typeof IntersectionObserver !== 'undefined') {
            intersectionObserver = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting
                visible ? start() : stop()
            }, { threshold: 0 })
            intersectionObserver.observe(container)
        }

        start()
    } catch (error) {
        webglFailed.value = true
        destroy()
    }
})

watch(() => [
    props.timeSpeed,
    props.colorBalance,
    props.warpStrength,
    props.warpFrequency,
    props.warpSpeed,
    props.warpAmplitude,
    props.blendAngle,
    props.blendSoftness,
    props.rotationAmount,
    props.noiseScale,
    props.grainAmount,
    props.grainScale,
    props.grainAnimated,
    props.contrast,
    props.gamma,
    props.saturation,
    props.centerX,
    props.centerY,
    props.zoom,
    props.color1,
    props.color2,
    props.color3
], updateUniforms)

onBeforeUnmount(destroy)
</script>

<style scoped lang="scss">
.short-drama-grainient-placeholder {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-radius: inherit;
    background:
        radial-gradient(circle at 22% 18%, rgba(82, 111, 115, 0.46), transparent 34%),
        radial-gradient(circle at 78% 74%, rgba(30, 50, 72, 0.58), transparent 42%),
        linear-gradient(135deg, #07131f 0%, #1e3248 52%, #293d42 100%);
    isolation: isolate;
}

.short-drama-grainient-placeholder::before,
.short-drama-grainient-placeholder::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
}

.short-drama-grainient-placeholder::before {
    z-index: 0;
    background:
        linear-gradient(110deg, transparent 0%, rgba(101, 140, 142, 0.13) 38%, transparent 70%),
        radial-gradient(circle at 50% 50%, rgba(64, 118, 125, 0.12), transparent 48%);
    opacity: 0.7;
    transform: scale(1.16);
    animation: short-drama-grainient-flow 5.8s ease-in-out infinite alternate;
    animation-delay: var(--grainient-animation-delay, 0s);
}

.short-drama-grainient-placeholder::after {
    z-index: 2;
    background-image:
        repeating-radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0 1px, transparent 1px 4px),
        linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.24));
    mix-blend-mode: screen;
    opacity: 0.12;
}

:deep(.short-drama-grainient-placeholder__canvas) {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
}

.short-drama-grainient-placeholder__label {
    position: relative;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    max-width: calc(100% - 16px);
    height: auto;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    backdrop-filter: none;
}

.short-drama-grainient-placeholder.is-compact .short-drama-grainient-placeholder__label {
    min-width: 0;
    height: auto;
    padding: 0;
    border-radius: 0;
    font-size: 10px;
}

.short-drama-grainient-placeholder.is-fallback::before {
    animation-duration: 3.4s;
}

@keyframes short-drama-grainient-flow {
    0% {
        transform: translate3d(-6%, -4%, 0) rotate(-8deg) scale(1.16);
    }

    100% {
        transform: translate3d(6%, 5%, 0) rotate(10deg) scale(1.22);
    }
}
</style>
