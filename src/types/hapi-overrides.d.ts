// @ts-nocheck
declare global {
  namespace NodeJS {
    interface Global {
      // Disable strict type checking for @hapi modules
    }
  }
}

// Override Array.concat to allow the @hapi/address usage
declare global {
  interface Array<T> {
    concat(...items: (T | ConcatArray<T> | any)[]): T[]
  }
}

// Add type compatibility for @hapi/address schemes
declare global {
  type HapiScheme = string | RegExp | { name: string; port?: number }
}

// Module augmentation for @hapi/address internal types
declare module '@hapi/address/src/uri' {
  // Override problematic types
  type SchemeType = any
  const schemes: any[]
}

export {}