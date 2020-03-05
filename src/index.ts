import ArcRotateCamera from './camera/ArcRotateCamera'
import DesktopInput from './input/DesktopInput'
import TouchInput from './input/TouchInput'
import { vec3, mat4 } from 'gl-matrix'
import Shader from './shader'
import vsSource from './main.vert'
import fsSource from './main.frag'

// const formatMat4 = (a: Float32Array) => {
//   return new Array(4).fill(1).reduce((prev, v, i) => {
//     const t = new Array(4).fill(1).map((v, j) => Math.abs(a[i * 4 + j]) < 1e-6 ? 0 : a[i * 4 + j])
//     return prev.concat(t.join(', ')).concat('\n')
//   }, '')
// }

const canvas = document.getElementById('main') as HTMLCanvasElement
canvas.height = window.innerHeight
canvas.width = window.innerWidth
const gl = canvas.getContext('webgl2', { premultipliedAlpha: false })
if (!gl) {
  throw new Error('webgl2 not available')
}
gl.viewport(0, 0, canvas.width, canvas.height)

const camera = new ArcRotateCamera(vec3.fromValues(0, 0.5, 0), Math.PI / 2, Math.PI / 2, 3)
const di = new DesktopInput(canvas)
const ti = new TouchInput(canvas)

const shader = new Shader(gl, vsSource, fsSource)
shader.use()
const quad = [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]
const quadVAO = gl.createVertexArray()
const quadVBO = gl.createBuffer()
gl.bindVertexArray(quadVAO)
gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, true, 8, 0)
gl.bindBuffer(gl.ARRAY_BUFFER, null)
// gl.bindVertexArray(null)

shader.setUniform('resolution', 'VEC2', [canvas.clientWidth, canvas.clientHeight])
const handleGlobalClick = (e: MouseEvent) => {
  shader.setUniform('mouse', 'VEC2', [e.clientX, e.clientY])
}
window.addEventListener('click', handleGlobalClick)

// const projectionMatrix = camera.getProjectionMatrix(gl.canvas.width / gl.canvas.height, 0.1, 1000)
shader.setUniform('fovy', 'FLOAT', Math.PI/4)

const viewMatrixInverse = mat4.create()
;(async () => {
  // const img = new Image()
  // img.src = '2k_moon.jpg'
  // await new Promise(resolve => {
  //   img.onload = () => resolve(img)
  // })
  // const texture = gl.createTexture()
  // gl.activeTexture(gl.TEXTURE0)
  // gl.bindTexture(gl.TEXTURE_2D, texture)
  // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, WebGL2RenderingContext.REPEAT)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, WebGL2RenderingContext.REPEAT)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, WebGL2RenderingContext.LINEAR)
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, WebGL2RenderingContext.LINEAR)

  gl.clearColor(0, 0, 0, 0)
  const renderLoop = (time: number) => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (window.innerHeight !== canvas.height || window.innerWidth !== canvas.width) {
      canvas.height = window.innerHeight
      canvas.width = window.innerWidth
      shader.setUniform('resolution', 'VEC2', [canvas.clientWidth, canvas.clientHeight])
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    camera.processDesktopInput(di)
    camera.processTouchInput(ti)
    shader.setUniform('time', 'FLOAT', time)
    shader.setUniform('cameraPosition', 'VEC3', camera.position)
    shader.setUniform('viewMatrixInverse', 'MAT4', mat4.invert(viewMatrixInverse, camera.viewMatrix))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    requestAnimationFrame(renderLoop)
  }
  requestAnimationFrame(renderLoop)
})()

