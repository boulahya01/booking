// Deno global types for type checking
declare global {
    interface Response {
        json(): Promise<unknown>
        text(): Promise<string>
        arrayBuffer(): Promise<ArrayBuffer>
        clone(): Response
        ok: boolean
        status: number
        statusText: string
        headers: Headers
        body: ReadableStream<Uint8Array> | null
        bodyUsed: boolean
    }

    interface Request {
        json(): Promise<unknown>
        text(): Promise<string>
        arrayBuffer(): Promise<ArrayBuffer>
        clone(): Request
        method: string
        url: string
        headers: Headers
        body: ReadableStream<Uint8Array> | null
        bodyUsed: boolean
    }

    interface Headers {
        append(name: string, value: string): void
        delete(name: string): void
        get(name: string): string | null
        has(name: string): boolean
        set(name: string, value: string): void
        forEach(callback: (value: string, key: string) => void): void
    }

    class Response {
        constructor(
            body?: BodyInit | null,
            init?: ResponseInit
        )
        static json(
            data: unknown,
            init?: ResponseInit
        ): Response
        static redirect(
            url: string | URL,
            status?: number
        ): Response
        static error(): Response
    }

    class Request {
        constructor(
            input: RequestInfo | URL,
            init?: RequestInit
        )
    }

    class Headers {
        constructor(init?: HeadersInit)
    }

    namespace console {
        function log(...args: unknown[]): void
        function error(...args: unknown[]): void
        function warn(...args: unknown[]): void
        function info(...args: unknown[]): void
        function debug(...args: unknown[]): void
    }

    var console: typeof console
}

export { }
