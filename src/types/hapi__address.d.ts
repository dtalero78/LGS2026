declare module '@hapi/address' {
  export interface UriOptions {
    scheme?: string | string[] | RegExp | RegExp[]
    allowRelative?: boolean
    relativeOnly?: boolean
    allowQuerySquareBrackets?: boolean
    domain?: {
      minDomainSegments?: number
      maxDomainSegments?: number
      tlds?: {
        allow?: boolean | Set<string> | string[]
        deny?: Set<string> | string[]
      }
    }
  }

  export interface ParsedUri {
    scheme?: string
    username?: string
    password?: string
    hostname?: string
    port?: string | number
    pathname?: string
    query?: string
    fragment?: string
  }

  export function uri(options?: UriOptions): {
    validate: (value: string) => { error?: Error; value?: ParsedUri }
  }

  export function domain(options?: any): {
    validate: (value: string) => { error?: Error; value?: string }
  }

  export function email(options?: any): {
    validate: (value: string) => { error?: Error; value?: string }
  }

  export function ip(options?: any): {
    validate: (value: string) => { error?: Error; value?: string }
  }
}

declare module '@hapi/address/src/uri' {
  interface Scheme {
    name: string
    port?: number
  }

  interface UriOptions {
    scheme?: any
    allowRelative?: boolean
    relativeOnly?: boolean
    allowQuerySquareBrackets?: boolean
  }

  // Override the problematic function
  const internals: any
  const assert: any
}