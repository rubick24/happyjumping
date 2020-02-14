declare module '*.vert' {
  const value: string
  export default value
}

declare module '*.frag' {
  const value: string
  export default value
}

declare module 'gl-matrix' {
  const value: any
  export default value
  export const glMatrix: any
  export const vec2: any
  export const vec3: any
  export const vec4: any
  export const mat2: any
  export const mat3: any
  export const mat4: any
  export const quat: any
}
